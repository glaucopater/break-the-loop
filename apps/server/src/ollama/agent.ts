import type { TokenUsage } from "@btl/core";
import { chatCompletion } from "./chat.js";
import { OLLAMA_AGENT_MODEL } from "./health.js";

const SYSTEM_PROMPT = `You are the user-facing assistant for Break the Loop.
You speak naturally and help users explore articles, products, and recipes.

You receive a compact orchestration summary only — not raw MCP/tool JSON.
The UI shows full data separately; summarize highlights briefly without inventing facts.

Keep replies concise (2–4 sentences). Be friendly and clear about sync vs async when relevant.`;

export async function generateAgentReply(input: {
  userMessage: string;
  orchestrationSummary: string;
}): Promise<{ message: string; tokenUsage: TokenUsage }> {
  const result = await chatCompletion(OLLAMA_AGENT_MODEL, [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `User asked: ${input.userMessage}\n\nOrchestration summary: ${input.orchestrationSummary}`,
    },
  ]);

  return { message: result.content, tokenUsage: result.tokenUsage };
}
