import type { TokenUsage } from "@btl/core";
import { chatCompletion, type ChatMessage } from "./chat.js";
import { OLLAMA_MODEL } from "./health.js";

const SYSTEM_PROMPT = `You are an event translator. Your ONLY job is to convert user requests into JSON atomic events.

Return ONLY valid JSON with no markdown, no explanation, no extra text.

Domains:
- "articles" — tech articles, architecture, caching, LLM/MCP topics (default)
- "products" — shop catalog, SKUs, prices, things to buy
- "recipes" — cooking, meals, ingredients, cuisine

Schema:
- Sync search: {"type":"QUERY_SYNC","intent":"search","domain":"<articles|products|recipes>","query":"<search terms>","limit":10}
- Sync count: {"type":"QUERY_SYNC","intent":"count","domain":"<articles|products|recipes>"}
- Async search: {"type":"QUERY_ASYNC","intent":"search","domain":"<articles|products|recipes>","query":"<search terms>","limit":10}
- Async count: {"type":"QUERY_ASYNC","intent":"count","domain":"<articles|products|recipes>"}

Rules:
- Pick domain from user intent: products for catalog/shopping, recipes for cooking/food, articles for everything else
- Use intent "count" when the user asks how many items exist in a domain
- For intent "search", extract search terms into "query"
- Use QUERY_SYNC unless the user explicitly asks for async, background, or delayed processing
- Prefixes [sync] or [async] force the mode
- Default domain is "articles" if unclear; default limit is 10 for search
- Do NOT answer the user's question
- Do NOT include any fields outside the schema`;

export type TranslateResult = {
  raw: string;
  tokenUsage: TokenUsage;
};

export async function translateToEvent(
  userMessage: string,
  forcedMode?: "sync" | "async",
): Promise<TranslateResult> {
  const modeHint: ChatMessage | null =
    forcedMode === "async"
      ? { role: "system", content: "The user forced ASYNC mode. Return QUERY_ASYNC." }
      : forcedMode === "sync"
        ? { role: "system", content: "The user forced SYNC mode. Return QUERY_SYNC." }
        : null;

  const result = await chatCompletion(
    OLLAMA_MODEL,
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...(modeHint ? [modeHint] : []),
      { role: "user", content: userMessage },
    ],
    { json: true },
  );

  return { raw: result.content, tokenUsage: result.tokenUsage };
}
