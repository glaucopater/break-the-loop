import { Fragment, useCallback, useEffect, useState } from "react";
import type { AuditTurn } from "@btl/core";
import { AuditTokenFlow } from "./AuditTokenFlow";

type Props = {
  apiBase: string;
  sessionId?: string;
  onBack: () => void;
};

export function AuditPage({ apiBase, sessionId, onBack }: Props) {
  const [turns, setTurns] = useState<AuditTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterSession.trim()) params.set("sessionId", filterSession.trim());
      const response = await fetch(`${apiBase}/audit/turns?${params}`);
      const body = (await response.json()) as { turns: AuditTurn[] };
      setTurns(body.turns);
    } finally {
      setLoading(false);
    }
  }, [apiBase, filterSession]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="audit-page">
      <header className="audit-header">
        <div>
          <h1>Audit log</h1>
          <p className="subtitle">
            All turns across sessions — case, model, API, mode, query, response
          </p>
        </div>
        <div className="audit-actions">
          <input
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            placeholder="Filter by session id (leave empty for all)…"
          />
          {sessionId ? (
            <button
              type="button"
              title={sessionId}
              onClick={() => setFilterSession(sessionId)}
            >
              This session
            </button>
          ) : null}
          {filterSession ? (
            <button type="button" onClick={() => setFilterSession("")}>
              Clear filter
            </button>
          ) : null}
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          <button type="button" onClick={onBack}>
            Back to chat
          </button>
        </div>
      </header>

      {loading && turns.length === 0 ? <p className="hint">Loading…</p> : null}

      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Case</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Model</th>
              <th>API</th>
              <th>Query</th>
              <th>Tokens (translator / loop / MCP)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {turns.map((turn) => (
              <Fragment key={turn.id}>
                <tr>
                  <td>{new Date(turn.createdAt).toLocaleString()}</td>
                  <td>
                    <span className={`case-tag case-tag--${turn.caseType.toLowerCase()}`}>
                      {turn.caseType}
                    </span>
                  </td>
                  <td>{turn.mode}</td>
                  <td>
                    <span className={`status-tag status-tag--${turn.status}`}>{turn.status}</span>
                  </td>
                  <td>{turn.ollamaModel ?? "—"}</td>
                  <td title={turn.mcpApi ?? undefined}>{turn.mcpApi ?? "—"}</td>
                  <td>{turn.queryText ?? turn.userMessage.slice(0, 40)}</td>
                  <td>
                    <AuditTokenFlow turn={turn} compact />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="audit-expand"
                      onClick={() => setExpandedId(expandedId === turn.id ? null : turn.id)}
                    >
                      {expandedId === turn.id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {expandedId === turn.id && (
                  <tr className="audit-detail-row">
                    <td colSpan={9}>
                      <AuditDetail turn={turn} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {turns.length === 0 && !loading && (
          <p className="hint">
            {filterSession.trim()
              ? "No turns for this session yet. Clear the filter to see all sessions, or send a chat message first."
              : "No turns recorded yet. Send a chat message to create one."}
          </p>
        )}
      </div>
    </div>
  );
}

function AuditDetail({ turn }: { turn: AuditTurn }) {
  const mcp = mcpResponseLabel(turn);
  const data = dataResponseLabel(turn);
  const badge = dataResponseBadge(turn.dataResponseJson);

  return (
    <div className="audit-detail">
      <AuditTokenFlow turn={turn} />
      <div className="audit-detail-grid">
        <AuditField title="User message" body={turn.userMessage} />
        <AuditField title="Agent reply (user-facing)" body={turn.agentMessage} />
        <AuditField title="Orchestrator ack (technical)" body={turn.agentAck} />
        <AuditField title="Ollama API" body={turn.ollamaApi} />
        <AuditField
          title="MCP tool / API"
          body={`${turn.mcpTool ?? "—"} · ${turn.mcpApi ?? "—"}`}
        />
        <AuditField title="Event JSON" body={turn.eventJson} />
        <AuditField title={mcp.title} hint={mcp.hint} body={turn.mcpResponseJson} />
        <AuditField
          title={data.title}
          hint={data.hint}
          body={turn.dataResponseJson}
          badge={badge}
        />
        {turn.jobId && <AuditField title="Job ID" body={turn.jobId} />}
        {turn.completedAt && turn.caseType === "QUERY_ASYNC" && (
          <AuditField
            title="Async completed at"
            body={new Date(turn.completedAt).toLocaleString()}
          />
        )}
        {turn.errorMessage && (
          <AuditField title="Error" body={turn.errorMessage} error />
        )}
      </div>
    </div>
  );
}

function AuditField({
  title,
  hint,
  body,
  badge,
  error,
}: {
  title: string;
  hint?: string;
  body: string | null | undefined;
  badge?: string;
  error?: boolean;
}) {
  return (
    <div>
      <div className="audit-field-head">
        <strong>{title}</strong>
        {badge ? <span className="audit-field-badge">{badge}</span> : null}
      </div>
      {hint ? <p className="audit-field-hint">{hint}</p> : null}
      <pre className={error ? "audit-error" : undefined}>{body ?? "—"}</pre>
    </div>
  );
}

function isCountTurn(turn: AuditTurn): boolean {
  if (turn.queryText?.startsWith("(count")) return true;
  try {
    const event = JSON.parse(turn.eventJson ?? "{}") as { intent?: string };
    return event.intent === "count";
  } catch {
    return false;
  }
}

function turnDomain(turn: AuditTurn): string {
  try {
    const event = JSON.parse(turn.eventJson ?? "{}") as { domain?: string };
    if (event.domain) return event.domain;
  } catch {
    // ignore
  }
  const match = turn.queryText?.match(/^\(count:(\w+)\)$/);
  return match?.[1] ?? "articles";
}

function dataResponseBadge(dataResponseJson: string | null): string | undefined {
  if (!dataResponseJson) return undefined;
  try {
    const parsed = JSON.parse(dataResponseJson) as unknown;
    if (Array.isArray(parsed)) {
      return `${parsed.length} article(s)`;
    }
    if (parsed && typeof parsed === "object" && "intent" in parsed) {
      const payload = parsed as {
        intent?: string;
        domain?: string;
        total?: number;
        data?: unknown[];
      };
      if (payload.intent === "count" && typeof payload.total === "number") {
        const domain = payload.domain ?? "articles";
        return `${payload.total} ${domain}`;
      }
      if (payload.intent === "search" && Array.isArray(payload.data)) {
        const domain = payload.domain ?? "articles";
        return `${payload.data.length} ${domain}`;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function mcpResponseLabel(turn: AuditTurn): { title: string; hint: string } {
  if (isCountTurn(turn)) {
    return {
      title: "MCP count ack",
      hint: "Count request handled by query_knowledge — returns total rows in the articles table.",
    };
  }
  if (turn.caseType === "QUERY_ASYNC") {
    return {
      title: "MCP job ack (immediate)",
      hint: "Returned when query_knowledge_async accepted the job — not the article data.",
    };
  }
  if (turn.caseType === "QUERY_SYNC") {
    return {
      title: "MCP sync summary",
      hint: "Row count from query_knowledge; full articles are listed below.",
    };
  }
  return { title: "MCP response", hint: "" };
}

function dataResponseLabel(turn: AuditTurn): { title: string; hint: string } {
  const domain = turnDomain(turn);
  const query = turn.queryText ? `"${turn.queryText}"` : "the translated query";

  if (isCountTurn(turn)) {
    const timing =
      turn.caseType === "QUERY_ASYNC" && turn.completedAt
        ? `Job finished ${new Date(turn.completedAt).toLocaleString()}.`
        : turn.caseType === "QUERY_ASYNC" && turn.status === "pending"
          ? "Job still running."
          : "";
    return {
      title:
        turn.caseType === "QUERY_ASYNC"
          ? `Count · ${domain} (async → SSE)`
          : `Count · ${domain} (sync)`,
      hint: `Total rows in the ${domain} table. ${timing}`.trim(),
    };
  }

  if (turn.caseType === "QUERY_ASYNC") {
    const timing = turn.completedAt
      ? `Job finished ${new Date(turn.completedAt).toLocaleString()}.`
      : turn.status === "pending"
        ? "Job still running — no articles yet."
        : "";
    return {
      title: `Results · ${domain} (async → SSE)`,
      hint: `Rows for ${query} from the ${domain} domain. Delivered via SSE — bypasses the agent. ${timing}`.trim(),
    };
  }

  if (turn.caseType === "QUERY_SYNC") {
    return {
      title: `Results · ${domain} (sync)`,
      hint: `Rows for ${query} from the ${domain} domain. Returned directly by MCP — not re-tokenized through the agent.`,
    };
  }

  return { title: "Data response", hint: "" };
}
