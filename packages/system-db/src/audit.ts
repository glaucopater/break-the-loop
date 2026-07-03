import type { AtomicEvent, ChatMode, ChatResponse, TokenUsage } from "@btl/core";
import type { AsyncJobPayload } from "./async-jobs.js";
import { openSystemDb } from "./schema.js";

export type AuditTurnRow = {
  id: string;
  session_id: string;
  case_type: string;
  mode: string;
  user_message: string;
  event_json: string | null;
  ollama_model: string | null;
  ollama_api: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  agent_ack: string | null;
  agent_message: string | null;
  agent_model: string | null;
  agent_input_tokens: number | null;
  agent_output_tokens: number | null;
  mcp_tool: string | null;
  mcp_api: string | null;
  job_id: string | null;
  status: string;
  query_text: string | null;
  mcp_response_json: string | null;
  data_response_json: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CreateAuditTurnInput = {
  id: string;
  sessionId: string;
  caseType: AtomicEvent["type"];
  mode: ChatMode;
  userMessage: string;
  event: AtomicEvent;
  translatorUsage: TokenUsage;
  agentUsage: TokenUsage;
  ollamaApi: string;
  response: ChatResponse;
};

export function createAuditTurn(input: CreateAuditTurnInput): void {
  const database = openSystemDb();
  const now = new Date().toISOString();
  const isAsync = input.response.mode === "async";
  const status = isAsync
    ? input.response.asyncAck?.success
      ? "pending"
      : "failed"
    : "completed";

  const isCount = input.event.intent === "count";
  const domain = input.event.domain;
  const queryText = isCount
    ? `(count:${domain})`
    : input.event.intent === "search"
      ? input.event.query
      : null;

  database
    .prepare(
      `INSERT INTO audit_turns (
        id, session_id, case_type, mode, user_message, event_json,
        ollama_model, ollama_api, input_tokens, output_tokens,
        agent_ack, agent_message, agent_model, agent_input_tokens, agent_output_tokens,
        mcp_tool, mcp_api, job_id, status, query_text,
        mcp_response_json, data_response_json, error_message, created_at, completed_at
      ) VALUES (
        @id, @session_id, @case_type, @mode, @user_message, @event_json,
        @ollama_model, @ollama_api, @input_tokens, @output_tokens,
        @agent_ack, @agent_message, @agent_model, @agent_input_tokens, @agent_output_tokens,
        @mcp_tool, @mcp_api, @job_id, @status, @query_text,
        @mcp_response_json, @data_response_json, @error_message, @created_at, @completed_at
      )`,
    )
    .run({
      id: input.id,
      session_id: input.sessionId,
      case_type: input.caseType,
      mode: input.mode,
      user_message: input.userMessage,
      event_json: JSON.stringify(input.event),
      ollama_model: input.translatorUsage.model,
      ollama_api: input.ollamaApi,
      input_tokens: input.translatorUsage.inputTokens,
      output_tokens: input.translatorUsage.outputTokens,
      agent_ack: input.response.agentAck,
      agent_message: input.response.agentMessage,
      agent_model: input.agentUsage.model,
      agent_input_tokens: input.agentUsage.inputTokens,
      agent_output_tokens: input.agentUsage.outputTokens,
      mcp_tool: isAsync ? "query_knowledge_async" : "query_knowledge",
      mcp_api: isAsync ? "mcp-sqlite-async" : "mcp-sqlite-sync",
      job_id: input.response.asyncAck?.jobId ?? null,
      status,
      query_text: queryText,
      mcp_response_json: isAsync
        ? JSON.stringify(input.response.asyncAck ?? null)
        : isCount
          ? JSON.stringify({ intent: "count", domain, total: input.response.count ?? 0 })
          : JSON.stringify({
              intent: "search",
              domain,
              count: input.response.data?.length ?? 0,
            }),
      data_response_json: isCount
        ? JSON.stringify({ intent: "count", domain, total: input.response.count ?? 0 })
        : input.response.data
          ? JSON.stringify({ intent: "search", domain, data: input.response.data })
          : null,
      error_message: input.response.asyncAck?.success === false ? input.response.asyncAck.error : null,
      created_at: now,
      completed_at: isAsync ? null : now,
    });
}

export function createFailedAuditTurn(input: {
  id: string;
  sessionId: string;
  mode: ChatMode;
  userMessage: string;
  ollamaApi: string;
  errorMessage: string;
}): void {
  const database = openSystemDb();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO audit_turns (
        id, session_id, case_type, mode, user_message, ollama_api,
        status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.sessionId,
      "UNKNOWN",
      input.mode,
      input.userMessage,
      input.ollamaApi,
      "failed",
      input.errorMessage,
      now,
    );
}

export function completeAuditTurnByJobId(jobId: string, payload: AsyncJobPayload): void {
  const database = openSystemDb();
  const now = new Date().toISOString();
  database
    .prepare(
      `UPDATE audit_turns
       SET status = 'completed', data_response_json = ?, completed_at = ?
       WHERE job_id = ?`,
    )
    .run(JSON.stringify(payload), now, jobId);
}

export function listAuditTurns(params?: {
  sessionId?: string;
  limit?: number;
}): AuditTurnRow[] {
  const database = openSystemDb();
  const limit = params?.limit ?? 100;

  if (params?.sessionId) {
    return database
      .prepare(
        `SELECT * FROM audit_turns WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(params.sessionId, limit) as AuditTurnRow[];
  }

  return database
    .prepare(`SELECT * FROM audit_turns ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as AuditTurnRow[];
}
