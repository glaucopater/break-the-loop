import type { AuditTurn } from "@btl/core";

export type StageTokens = {
  input: number;
  output: number;
};

export type TurnTokenFlow = {
  translator: StageTokens;
  userAgent: StageTokens;
  agentLoop: StageTokens;
  mcp: StageTokens;
  mcpPayloadChars: number;
  tokensAvoidedEstimate: number;
};

export function estimateTokensFromChars(chars: number): number {
  return chars > 0 ? Math.max(1, Math.round(chars / 4)) : 0;
}

export function getTurnTokenFlow(turn: AuditTurn): TurnTokenFlow {
  let mcpPayloadChars = 0;
  for (const json of [turn.mcpResponseJson, turn.dataResponseJson]) {
    if (json) mcpPayloadChars += json.length;
  }

  const tokensAvoidedEstimate = estimateTokensFromChars(mcpPayloadChars);

  return {
    translator: { input: turn.inputTokens ?? 0, output: turn.outputTokens ?? 0 },
    userAgent: {
      input: turn.agentInputTokens ?? 0,
      output: turn.agentOutputTokens ?? 0,
    },
    agentLoop: { input: 0, output: 0 },
    mcp: { input: 0, output: 0 },
    mcpPayloadChars,
    tokensAvoidedEstimate,
  };
}

export function formatStageTokens({ input, output }: StageTokens): string {
  if (input === 0 && output === 0) return "0";
  return `${input} in · ${output} out`;
}

export function getTokenStageHints(turn: AuditTurn) {
  const translatorModel = turn.ollamaModel ?? "translator model";
  const agentModel = turn.agentModel ?? "agent model";

  return {
    translator: `Translator (${translatorModel}): converts user message → atomic event JSON for MCP. Does not talk to the user.`,
    userAgent: `User agent (${agentModel}): natural-language reply from a compact summary — not raw MCP payloads.`,
    agentLoop:
      "Classic re-ingest loop: full MCP JSON would enter the model here. Skipped by design (~tokens saved shown).",
    mcp: "MCP tools: JSON over stdio, not LLM-tokenized.",
  };
}
