import { z } from "zod";
import { knowledgeDomainSchema } from "./domains.js";

export const knowledgeIntentSchema = z.enum(["search", "count"]);

const domainField = { domain: knowledgeDomainSchema.default("articles") };

export const querySyncSearchSchema = z.object({
  type: z.literal("QUERY_SYNC"),
  intent: z.literal("search"),
  ...domainField,
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});

export const querySyncCountSchema = z.object({
  type: z.literal("QUERY_SYNC"),
  intent: z.literal("count"),
  ...domainField,
});

export const queryAsyncSearchSchema = z.object({
  type: z.literal("QUERY_ASYNC"),
  intent: z.literal("search"),
  ...domainField,
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});

export const queryAsyncCountSchema = z.object({
  type: z.literal("QUERY_ASYNC"),
  intent: z.literal("count"),
  ...domainField,
});

export const querySyncEventSchema = z.discriminatedUnion("intent", [
  querySyncSearchSchema,
  querySyncCountSchema,
]);

export const queryAsyncEventSchema = z.discriminatedUnion("intent", [
  queryAsyncSearchSchema,
  queryAsyncCountSchema,
]);

export const atomicEventSchema = z.union([
  querySyncSearchSchema,
  querySyncCountSchema,
  queryAsyncSearchSchema,
  queryAsyncCountSchema,
]);

export type KnowledgeIntent = z.infer<typeof knowledgeIntentSchema>;
export type QuerySyncEvent = z.infer<typeof querySyncEventSchema>;
export type QueryAsyncEvent = z.infer<typeof queryAsyncEventSchema>;
export type AtomicEvent = z.infer<typeof atomicEventSchema>;
