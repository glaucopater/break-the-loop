import { z } from "zod";
import type { KnowledgeDomain, KnowledgeRecord } from "./domains.js";
import { atomicEventSchema } from "./events.js";
import { tokenUsageSchema } from "./tokens.js";

export type { Article, Product, Recipe, KnowledgeRecord, KnowledgeDomain } from "./domains.js";
export { articleSchema, productSchema, recipeSchema, knowledgeDomainSchema } from "./domains.js";

export type ChatMode = "sync" | "async" | "auto";

export type AsyncJobAck = {
  success: boolean;
  jobId?: string;
  error?: string;
};

export type AsyncResultEvent = {
  type: "ASYNC_RESULT";
  jobId: string;
  domain: KnowledgeDomain;
  intent: "search" | "count";
  query?: string;
  data?: KnowledgeRecord[];
  total?: number;
  agentMessage?: string;
};

export type ChatResponse = {
  sessionId: string;
  event: z.infer<typeof atomicEventSchema>;
  agentMessage: string;
  agentAck: string;
  mode: "sync" | "async";
  domain?: KnowledgeDomain;
  resultIntent?: "search" | "count";
  data?: KnowledgeRecord[];
  count?: number;
  asyncAck?: AsyncJobAck;
  /** Translator (MCP routing) model — gemma4:e2b */
  tokenUsage: z.infer<typeof tokenUsageSchema>;
  /** User-facing chat agent model */
  agentTokenUsage: z.infer<typeof tokenUsageSchema>;
  tokenSummary: {
    cumulativeInputTokens: number;
    cumulativeOutputTokens: number;
    turnCount: number;
    lastTranslatorTurn: z.infer<typeof tokenUsageSchema> | null;
    lastAgentTurn: z.infer<typeof tokenUsageSchema> | null;
  };
};
