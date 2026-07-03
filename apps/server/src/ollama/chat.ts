import type { TokenUsage } from "@btl/core";
import { OLLAMA_BASE_URL } from "./health.js";

type OllamaChatResponse = {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatCompletionResult = {
  content: string;
  tokenUsage: TokenUsage;
};

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  options?: { json?: boolean },
): Promise<ChatCompletionResult> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      ...(options?.json ? { format: "json" } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      // keep raw body
    }
    throw new Error(
      `Ollama request failed (${model}): ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  const data = (await response.json()) as OllamaChatResponse;
  return {
    content: data.message.content.trim(),
    tokenUsage: {
      model: data.model,
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      totalDurationNs: data.total_duration,
      timestamp: new Date().toISOString(),
    },
  };
}
