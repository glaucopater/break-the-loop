export type AuditTurn = {
  id: string;
  sessionId: string;
  caseType: string;
  mode: string;
  userMessage: string;
  eventJson: string | null;
  ollamaModel: string | null;
  ollamaApi: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  agentAck: string | null;
  agentMessage: string | null;
  agentModel: string | null;
  agentInputTokens: number | null;
  agentOutputTokens: number | null;
  mcpTool: string | null;
  mcpApi: string | null;
  jobId: string | null;
  status: string;
  queryText: string | null;
  mcpResponseJson: string | null;
  dataResponseJson: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AuditTurnRowLike = {
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
  agent_message?: string | null;
  agent_model?: string | null;
  agent_input_tokens?: number | null;
  agent_output_tokens?: number | null;
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

export function mapAuditTurn(row: AuditTurnRowLike): AuditTurn {
  return {
    id: row.id,
    sessionId: row.session_id,
    caseType: row.case_type,
    mode: row.mode,
    userMessage: row.user_message,
    eventJson: row.event_json,
    ollamaModel: row.ollama_model,
    ollamaApi: row.ollama_api,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    agentAck: row.agent_ack,
    agentMessage: row.agent_message ?? null,
    agentModel: row.agent_model ?? null,
    agentInputTokens: row.agent_input_tokens ?? null,
    agentOutputTokens: row.agent_output_tokens ?? null,
    mcpTool: row.mcp_tool,
    mcpApi: row.mcp_api,
    jobId: row.job_id,
    status: row.status,
    queryText: row.query_text,
    mcpResponseJson: row.mcp_response_json,
    dataResponseJson: row.data_response_json,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
