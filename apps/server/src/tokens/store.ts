import type { TokenUsage, TokenUsageSummary } from "@btl/core";

const sessions = new Map<string, TokenUsageSummary>();

export function getTokenSummary(sessionId: string): TokenUsageSummary {
  return (
    sessions.get(sessionId) ?? {
      lastTurn: null,
      lastTranslatorTurn: null,
      lastAgentTurn: null,
      cumulativeInputTokens: 0,
      cumulativeOutputTokens: 0,
      turnCount: 0,
    }
  );
}

export function recordTurnTokenUsage(
  sessionId: string,
  translator: TokenUsage,
  agent: TokenUsage,
): TokenUsageSummary {
  const current = getTokenSummary(sessionId);
  const combinedInput = translator.inputTokens + agent.inputTokens;
  const combinedOutput = translator.outputTokens + agent.outputTokens;

  const updated: TokenUsageSummary = {
    lastTranslatorTurn: translator,
    lastAgentTurn: agent,
    lastTurn: {
      model: `${translator.model} + ${agent.model}`,
      inputTokens: combinedInput,
      outputTokens: combinedOutput,
      timestamp: agent.timestamp,
    },
    cumulativeInputTokens: current.cumulativeInputTokens + combinedInput,
    cumulativeOutputTokens: current.cumulativeOutputTokens + combinedOutput,
    turnCount: current.turnCount + 1,
  };
  sessions.set(sessionId, updated);
  return updated;
}

/** @deprecated use recordTurnTokenUsage */
export function recordTokenUsage(sessionId: string, usage: TokenUsage): TokenUsageSummary {
  return recordTurnTokenUsage(sessionId, usage, {
    ...usage,
    model: "none",
    inputTokens: 0,
    outputTokens: 0,
  });
}
