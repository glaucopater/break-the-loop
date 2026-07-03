import {
  atomicEventSchema,
  type AtomicEvent,
  type ChatMode,
  type KnowledgeDomain,
  domainItemLabel,
} from "@btl/core";
import {
  countKnowledgeAsync,
  countKnowledgeSync,
  queryKnowledgeAsync,
  queryKnowledgeSync,
} from "../mcp/client.js";
import type { TokenUsage } from "@btl/core";

export type DispatchResult = {
  sessionId: string;
  event: AtomicEvent;
  agentAck: string;
  mode: "sync" | "async";
  domain: KnowledgeDomain;
  resultIntent?: "search" | "count";
  data?: import("@btl/core").KnowledgeRecord[];
  count?: number;
  asyncAck?: import("@btl/core").AsyncJobAck;
};

function extractForcedMode(message: string): { mode?: "sync" | "async"; text: string } {
  const syncMatch = message.match(/^\[sync\]\s*/i);
  if (syncMatch) {
    return { mode: "sync", text: message.slice(syncMatch[0].length).trim() };
  }
  const asyncMatch = message.match(/^\[async\]\s*/i);
  if (asyncMatch) {
    return { mode: "async", text: message.slice(asyncMatch[0].length).trim() };
  }
  return { text: message.trim() };
}

function parseAtomicEvent(raw: string, preferredMode?: "sync" | "async"): AtomicEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Ollama returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  const event = atomicEventSchema.parse(parsed);

  if (preferredMode === "sync" && event.type === "QUERY_ASYNC") {
    return event.intent === "count"
      ? { type: "QUERY_SYNC", intent: "count", domain: event.domain }
      : { ...event, type: "QUERY_SYNC" };
  }
  if (preferredMode === "async" && event.type === "QUERY_SYNC") {
    return event.intent === "count"
      ? { type: "QUERY_ASYNC", intent: "count", domain: event.domain }
      : { ...event, type: "QUERY_ASYNC" };
  }

  return event;
}

export async function dispatchChat(params: {
  sessionId: string;
  message: string;
  mode: ChatMode;
  rawEventJson: string;
}): Promise<DispatchResult> {
  const { sessionId, message, mode, rawEventJson } = params;
  const { mode: prefixMode } = extractForcedMode(message);
  const forcedMode = prefixMode ?? (mode === "auto" ? undefined : mode);
  const event = parseAtomicEvent(rawEventJson, forcedMode);
  const domain = event.domain;

  if (event.type === "QUERY_SYNC" && event.intent === "count") {
    const count = await countKnowledgeSync(domain);
    const item = domainItemLabel(domain);
    return {
      sessionId,
      event,
      mode: "sync",
      domain,
      resultIntent: "count",
      count,
      agentAck: `QUERY_SYNC count · ${domain} → ${count} ${item}(s)`,
    };
  }

  if (event.type === "QUERY_SYNC") {
    const data = await queryKnowledgeSync(domain, event.query, event.limit);
    const item = domainItemLabel(domain);
    return {
      sessionId,
      event,
      mode: "sync",
      domain,
      resultIntent: "search",
      agentAck: `QUERY_SYNC ${domain} → ${data.length} ${item}(s)`,
      data,
    };
  }

  if (event.intent === "count") {
    const asyncAck = await countKnowledgeAsync(domain, sessionId);
    return {
      sessionId,
      event,
      mode: "async",
      domain,
      resultIntent: "count",
      agentAck: asyncAck.success
        ? `QUERY_ASYNC count · ${domain} → job ${asyncAck.jobId}`
        : `QUERY_ASYNC count failed · ${domain}`,
      asyncAck,
    };
  }

  const asyncAck = await queryKnowledgeAsync(domain, event.query, sessionId, event.limit);
  return {
    sessionId,
    event,
    mode: "async",
    domain,
    resultIntent: "search",
    agentAck: asyncAck.success
      ? `QUERY_ASYNC ${domain} → job ${asyncAck.jobId}`
      : `QUERY_ASYNC failed · ${domain}`,
    asyncAck,
  };
}
