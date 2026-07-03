import type { KnowledgeDomain, KnowledgeRecord } from "@btl/core";
import { domainItemLabel, isArticle, isProduct, isRecipe } from "@btl/core";

function itemLabel(record: KnowledgeRecord): string {
  if (isProduct(record)) return record.name;
  if (isRecipe(record)) return record.title;
  if (isArticle(record)) return record.title;
  return "item";
}

export function summarizeRecords(records: KnowledgeRecord[], limit = 8): string {
  if (records.length === 0) return "none";
  const names = records.slice(0, limit).map(itemLabel);
  const extra = records.length > limit ? ` (+${records.length - limit} more)` : "";
  return `${names.join(", ")}${extra}`;
}

export function buildOrchestrationSummary(response: {
  mode: "sync" | "async";
  domain?: KnowledgeDomain;
  event: { domain: KnowledgeDomain; intent: string; type: string };
  resultIntent?: "search" | "count";
  data?: KnowledgeRecord[];
  count?: number;
  asyncAck?: { success: boolean; jobId?: string; error?: string };
}): string {
  const domain = response.domain ?? response.event.domain;
  const item = domainItemLabel(domain);
  const mode = response.mode;
  const intent = response.resultIntent ?? response.event.intent;

  if (intent === "count" && response.count !== undefined) {
    return `Mode: ${mode}. Domain: ${domain}. Count query returned ${response.count} ${item}(s).`;
  }

  if (response.data && response.data.length > 0) {
    return `Mode: ${mode}. Domain: ${domain}. Search returned ${response.data.length} ${item}(s): ${summarizeRecords(response.data)}. Full rows are shown separately in the UI — do not repeat every field.`;
  }

  if (response.asyncAck?.success && response.asyncAck.jobId) {
    return `Mode: async. Domain: ${domain}. Background job ${response.asyncAck.jobId} submitted; results will arrive shortly.`;
  }

  if (response.asyncAck && !response.asyncAck.success) {
    return `Mode: async. Domain: ${domain}. Job submission failed: ${response.asyncAck.error ?? "unknown error"}.`;
  }

  return `Mode: ${mode}. Domain: ${domain}. Event ${response.event.type} dispatched.`;
}

export function buildAsyncResultSummary(input: {
  domain: string;
  intent: "search" | "count";
  query?: string;
  data?: KnowledgeRecord[];
  total?: number;
}): string {
  const item = domainItemLabel(input.domain as KnowledgeDomain);
  if (input.intent === "count" && input.total !== undefined) {
    return `Async job completed. Domain: ${input.domain}. Count: ${input.total} ${item}(s).`;
  }
  const count = input.data?.length ?? 0;
  const names = input.data ? summarizeRecords(input.data) : "none";
  return `Async job completed. Domain: ${input.domain}. Query: "${input.query ?? ""}". Found ${count} ${item}(s): ${names}. Full rows are shown separately in the UI.`;
}
