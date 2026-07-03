import type { OllamaStatus } from "@btl/core";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e2b";
const OLLAMA_AGENT_MODEL = process.env.OLLAMA_AGENT_MODEL ?? "qwen3.5:0.8b";
const OLLAMA_PROBE_CHAT = process.env.OLLAMA_PROBE_CHAT === "true";
const TAGS_TIMEOUT_MS = Number(process.env.OLLAMA_TAGS_TIMEOUT_MS ?? 250);
const HEALTH_CACHE_TTL_MS = Number(process.env.HEALTH_CACHE_TTL_MS ?? 15_000);

type OllamaTagsResponse = {
  models?: Array<{ name: string }>;
};

type OllamaChatResponse = {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
};

const SKIPPED_CHAT: OllamaStatus["chat"] = {
  ok: false,
  error: "Chat probe skipped (pass ?probeChat=true)",
};

let cachedFastStatus: OllamaStatus | null = null;
let cachedAt = 0;
let refreshInFlight: Promise<OllamaStatus> | null = null;

function modelMatches(available: string, configured: string): boolean {
  if (available === configured) return true;
  return available.startsWith(`${configured}:`) || available.startsWith(`${configured}@`);
}

export function isModelAvailable(models: string[], configuredModel: string): boolean {
  return models.some((name) => modelMatches(name, configuredModel));
}

async function checkTags(): Promise<OllamaStatus["tags"]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        models: [],
        error: `GET /api/tags failed: ${response.status} ${response.statusText}`,
      };
    }
    const data = (await response.json()) as OllamaTagsResponse;
    return { ok: true, models: (data.models ?? []).map((m) => m.name) };
  } catch (error) {
    return {
      ok: false,
      models: [],
      error: error instanceof Error ? error.message : "Failed to reach Ollama API",
    };
  }
}

function buildFastStatus(tags: OllamaStatus["tags"]): OllamaStatus {
  const reachable = tags.ok;
  const translatorAvailable = tags.ok && isModelAvailable(tags.models, OLLAMA_MODEL);
  const agentAvailable = tags.ok && isModelAvailable(tags.models, OLLAMA_AGENT_MODEL);

  return {
    reachable,
    ready: reachable && translatorAvailable && agentAvailable,
    baseUrl: OLLAMA_BASE_URL,
    configuredModel: OLLAMA_MODEL,
    configuredAgentModel: OLLAMA_AGENT_MODEL,
    tags,
    chat: SKIPPED_CHAT,
    modelAvailable: translatorAvailable,
    agentModelAvailable: agentAvailable,
  };
}

async function refreshFastStatus(): Promise<OllamaStatus> {
  const status = buildFastStatus(await checkTags());
  cachedFastStatus = status;
  cachedAt = Date.now();
  return status;
}

function scheduleFastRefresh(): void {
  if (refreshInFlight) return;
  refreshInFlight = refreshFastStatus().finally(() => {
    refreshInFlight = null;
  });
}

async function getCachedFastStatus(): Promise<OllamaStatus> {
  const age = Date.now() - cachedAt;
  if (cachedFastStatus && age < HEALTH_CACHE_TTL_MS) {
    return cachedFastStatus;
  }

  if (cachedFastStatus) {
    scheduleFastRefresh();
    return cachedFastStatus;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = refreshFastStatus().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function runChatProbe(model: string): Promise<OllamaStatus["chat"]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
        stream: false,
        options: { num_predict: 8 },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        error: `POST /api/chat failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await response.json()) as OllamaChatResponse;
    return {
      ok: true,
      model: data.model,
      inputTokens: data.prompt_eval_count,
      outputTokens: data.eval_count,
      sample: data.message.content.trim().slice(0, 80),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "POST /api/chat probe failed",
    };
  }
}

async function getProbedStatus(): Promise<OllamaStatus> {
  const base = buildFastStatus(await checkTags());
  const { tags } = base;

  if (!tags.ok) {
    return { ...base, chat: { ok: false, error: tags.error ?? "Ollama unreachable" } };
  }

  if (!base.modelAvailable || !base.agentModelAvailable) {
    const missing = [
      !base.modelAvailable ? `translator "${OLLAMA_MODEL}"` : null,
      !base.agentModelAvailable ? `agent "${OLLAMA_AGENT_MODEL}"` : null,
    ].filter(Boolean);
    return { ...base, chat: { ok: false, error: `Missing models: ${missing.join(", ")}` } };
  }

  const [translatorProbe, agentProbe] = await Promise.all([
    runChatProbe(OLLAMA_MODEL),
    runChatProbe(OLLAMA_AGENT_MODEL),
  ]);

  const chat: OllamaStatus["chat"] = {
    ok: translatorProbe.ok && agentProbe.ok,
    model: `${OLLAMA_MODEL} + ${OLLAMA_AGENT_MODEL}`,
    inputTokens: (translatorProbe.inputTokens ?? 0) + (agentProbe.inputTokens ?? 0),
    outputTokens: (translatorProbe.outputTokens ?? 0) + (agentProbe.outputTokens ?? 0),
    sample: agentProbe.sample ?? translatorProbe.sample,
    error:
      !translatorProbe.ok
        ? `Translator: ${translatorProbe.error}`
        : !agentProbe.ok
          ? `Agent: ${agentProbe.error}`
          : undefined,
  };

  return {
    ...base,
    ready: base.ready && chat.ok,
    chat,
  };
}

export async function getOllamaStatus(options?: { probeChat?: boolean }): Promise<OllamaStatus> {
  const shouldProbeChat = options?.probeChat ?? OLLAMA_PROBE_CHAT;
  if (shouldProbeChat) {
    return getProbedStatus();
  }
  return getCachedFastStatus();
}

export function startOllamaHealthWatcher(): void {
  scheduleFastRefresh();
  setInterval(() => scheduleFastRefresh(), HEALTH_CACHE_TTL_MS);
}

export async function checkOllamaHealth(): Promise<boolean> {
  const status = await getCachedFastStatus();
  return status.reachable && status.modelAvailable && status.agentModelAvailable;
}

export { OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_AGENT_MODEL };
