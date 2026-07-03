import { z } from "zod";

export const tokenUsageSchema = z.object({
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalDurationNs: z.number().int().nonnegative().optional(),
  timestamp: z.string(),
});

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export type TokenUsageSummary = {
  lastTurn: TokenUsage | null;
  lastTranslatorTurn: TokenUsage | null;
  lastAgentTurn: TokenUsage | null;
  cumulativeInputTokens: number;
  cumulativeOutputTokens: number;
  turnCount: number;
};
