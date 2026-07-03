import type { KnowledgeDomain, KnowledgeIntent, KnowledgeRecord } from "@btl/core";
import { openSystemDb } from "./schema.js";

export type AsyncJobRow = {
  job_id: string;
  session_id: string;
  query_text: string;
  data_response_json: string;
  delivered: number;
  created_at: string;
};

export type AsyncJobPayload =
  | { intent: "search"; domain: KnowledgeDomain; query: string; data: KnowledgeRecord[] }
  | { intent: "count"; domain: KnowledgeDomain; total: number };

export function storeAsyncJobResult(
  input:
    | {
        jobId: string;
        sessionId: string;
        intent: "search";
        domain: KnowledgeDomain;
        query: string;
        data: KnowledgeRecord[];
      }
    | { jobId: string; sessionId: string; intent: "count"; domain: KnowledgeDomain; total: number },
): void {
  const database = openSystemDb();
  const payload: AsyncJobPayload =
    input.intent === "count"
      ? { intent: "count", domain: input.domain, total: input.total }
      : {
          intent: "search",
          domain: input.domain,
          query: input.query,
          data: input.data,
        };
  const queryText =
    input.intent === "count" ? `(count:${input.domain})` : input.query;

  database
    .prepare(
      `INSERT OR REPLACE INTO async_job_results (job_id, session_id, query_text, data_response_json, delivered, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    .run(
      input.jobId,
      input.sessionId,
      queryText,
      JSON.stringify(payload),
      new Date().toISOString(),
    );
}

export function parseAsyncJobPayload(raw: string): AsyncJobPayload {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return { intent: "search", domain: "articles", query: "", data: parsed as KnowledgeRecord[] };
  }
  const payload = parsed as AsyncJobPayload & { domain?: KnowledgeDomain };
  if (!payload.domain) {
    return { ...payload, domain: "articles" };
  }
  return payload;
}

export function getUndeliveredAsyncJobs(): AsyncJobRow[] {
  const database = openSystemDb();
  return database
    .prepare(`SELECT * FROM async_job_results WHERE delivered = 0 ORDER BY created_at ASC`)
    .all() as AsyncJobRow[];
}

export function markAsyncJobDelivered(jobId: string): void {
  const database = openSystemDb();
  database.prepare(`UPDATE async_job_results SET delivered = 1 WHERE job_id = ?`).run(jobId);
}
