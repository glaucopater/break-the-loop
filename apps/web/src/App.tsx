import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AsyncResultEvent, ChatMode, ChatResponse, KnowledgeDomain, KnowledgeRecord, TokenUsage } from "@btl/core";
import { domainItemLabel } from "@btl/core";
import { TokenPanel } from "./TokenPanel";
import { OllamaStatusBadge } from "./OllamaStatusBadge";
import { AuditPage } from "./AuditPage";
import { formatTimestamp, TurnMeta } from "./format";
import { KnowledgeResultList } from "./KnowledgeResults";
type Page = "chat" | "audit";

type Message =
  | { id: string; kind: "user"; text: string; timestamp: string }
  | {
      id: string;
      kind: "agent-reply";
      text: string;
      eventType: string;
      timestamp: string;
      translatorUsage: TokenUsage;
      agentUsage: TokenUsage;
    }
  | { id: string; kind: "agent-followup"; text: string; timestamp: string }
  | { id: string; kind: "data-result"; domain: KnowledgeDomain; items: KnowledgeRecord[]; label: string; timestamp: string }
  | { id: string; kind: "count-result"; domain: KnowledgeDomain; total: number; label: string; timestamp: string }
  | { id: string; kind: "async-pending"; jobId: string; text: string; timestamp: string; completed?: boolean }
  | { id: string; kind: "error"; text: string; timestamp: string };

function uid(): string {
  return crypto.randomUUID();
}

export function App() {
  const [page, setPage] = useState<Page>("chat");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<ChatMode>("auto");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastTranslatorTurn, setLastTranslatorTurn] = useState<TokenUsage | null>(null);
  const [lastAgentTurn, setLastAgentTurn] = useState<TokenUsage | null>(null);
  const [cumulative, setCumulative] = useState({ input: 0, output: 0, turns: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const deliveredJobIds = useRef(new Set<string>());

  const apiBase = useMemo(() => "/api", []);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const source = new EventSource(`${apiBase}/events/${sessionId}`);

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as AsyncResultEvent | { type: "CONNECTED" };
      if (payload.type === "ASYNC_RESULT") {
        if (deliveredJobIds.current.has(payload.jobId)) return;
        deliveredJobIds.current.add(payload.jobId);

        setMessages((prev) =>
          prev.map((m) =>
            m.kind === "async-pending" && m.jobId === payload.jobId ? { ...m, completed: true } : m,
          ),
        );
        if (payload.agentMessage) {
          appendMessage({
            id: uid(),
            kind: "agent-followup",
            text: payload.agentMessage,
            timestamp: new Date().toISOString(),
          });
        }
        if (payload.intent === "count" && payload.total !== undefined) {
          appendMessage({
            id: uid(),
            kind: "count-result",
            domain: payload.domain,
            label: `Async count · ${payload.domain} · job ${payload.jobId}`,
            total: payload.total,
            timestamp: new Date().toISOString(),
          });
        } else {
          appendMessage({
            id: uid(),
            kind: "data-result",
            domain: payload.domain,
            label: `Async result · ${payload.domain} · job ${payload.jobId}`,
            items: payload.data ?? [],
            timestamp: new Date().toISOString(),
          });
        }
      }
    };

    source.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => source.close();
  }, [apiBase, sessionId, appendMessage]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    appendMessage({ id: uid(), kind: "user", text, timestamp: new Date().toISOString() });

    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, mode }),
      });

      const body = (await response.json()) as ChatResponse | { error: string };

      if (!response.ok || "error" in body) {
        appendMessage({
          id: uid(),
          kind: "error",
          text: "error" in body ? body.error : "Request failed",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const chat = body as ChatResponse;
      setLastTranslatorTurn(chat.tokenUsage);
      setLastAgentTurn(chat.agentTokenUsage);
      setCumulative({
        input: chat.tokenSummary.cumulativeInputTokens,
        output: chat.tokenSummary.cumulativeOutputTokens,
        turns: chat.tokenSummary.turnCount,
      });

      appendMessage({
        id: uid(),
        kind: "agent-reply",
        text: chat.agentMessage,
        eventType: chat.event.type,
        timestamp: chat.agentTokenUsage.timestamp,
        translatorUsage: chat.tokenUsage,
        agentUsage: chat.agentTokenUsage,
      });

      const domain = chat.domain ?? chat.event.domain;

      if (chat.mode === "sync" && chat.resultIntent === "count" && chat.count !== undefined) {
        appendMessage({
          id: uid(),
          kind: "count-result",
          domain,
          label: `Sync count · ${domain}`,
          total: chat.count,
          timestamp: new Date().toISOString(),
        });
      } else if (chat.mode === "sync" && chat.data) {
        appendMessage({
          id: uid(),
          kind: "data-result",
          domain,
          label: `Sync data · ${domain}`,
          items: chat.data,
          timestamp: new Date().toISOString(),
        });
      }
      if (chat.mode === "async" && chat.asyncAck?.success && chat.asyncAck.jobId) {
        appendMessage({
          id: uid(),
          kind: "async-pending",
          jobId: chat.asyncAck.jobId,
          text: `Waiting for async job ${chat.asyncAck.jobId} via SSE...`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      appendMessage({
        id: uid(),
        kind: "error",
        text: error instanceof Error ? error.message : "Network error",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  if (page === "audit") {
    return <AuditPage apiBase={apiBase} sessionId={sessionId} onBack={() => setPage("chat")} />;
  }

  return (
    <div className="layout">
      <header className="header">
        <div>
          <h1>Break the Loop</h1>
          <p className="subtitle">Agent translates → events dispatch → data bypasses the loop</p>
        </div>
        <div className="header-actions">
          <OllamaStatusBadge apiBase={apiBase} />
          <span className="session">Session: {sessionId.slice(0, 8)}…</span>
          <button type="button" className="nav-link" onClick={() => setPage("audit")}>
            Audit log
          </button>
        </div>
      </header>

      <main className="main">
        <section className="chat">
          <div className="messages">
            {messages.length === 0 && (
              <p className="hint">
                Try: <code>find articles about caching</code>,{" "}
                <code>show coffee products</code>, <code>italian pasta recipes</code>,{" "}
                <code>how many recipes?</code>, or prefix with <code>[async]</code> /{" "}
                <code>[sync]</code>              </p>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {loading && <ProgressBubble mode={mode} />}
            <div ref={bottomRef} />
          </div>

          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <div className="composer-toolbar">
              <span className="composer-toolbar-label">Dispatch mode</span>
              <div className="mode-segment" role="group" aria-label="Dispatch mode">
                {(
                  [
                    ["auto", "Auto"],
                    ["sync", "Sync"],
                    ["async", "Async"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`mode-segment-btn${mode === value ? " mode-segment-btn--active" : ""}`}
                    aria-pressed={mode === value}
                    disabled={loading}
                    onClick={() => setMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="composer-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about articles, products, or recipes…"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()} className="composer-send">
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    <span>Sending</span>
                  </>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </form>
        </section>

        <TokenPanel
          lastTranslatorTurn={lastTranslatorTurn}
          lastAgentTurn={lastAgentTurn}
          cumulativeInput={cumulative.input}
          cumulativeOutput={cumulative.output}
          turnCount={cumulative.turns}
        />
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.kind === "user") {
    return (
      <div className="bubble user">
        <div className="bubble-header">
          <span className="label">You</span>
          <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
        </div>
        <p>{message.text}</p>
      </div>
    );
  }

  if (message.kind === "agent-reply") {
    return (
      <div className="bubble agent">
        <div className="bubble-header">
          <span className="label">Agent · {message.eventType}</span>
          <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
        </div>
        <p>{message.text}</p>
        <TurnMeta translatorUsage={message.translatorUsage} agentUsage={message.agentUsage} />
      </div>
    );
  }

  if (message.kind === "agent-followup") {
    return (
      <div className="bubble agent">
        <div className="bubble-header">
          <span className="label">Agent · async complete</span>
          <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
        </div>
        <p>{message.text}</p>
      </div>
    );
  }

  if (message.kind === "async-pending") {
    return (
      <div className={`bubble pending${message.completed ? " pending--done" : ""}`}>
        <div className="bubble-header">
          <span className="label">
            {message.completed ? "Async complete" : "Async pending"} · {message.jobId.slice(0, 8)}…
          </span>
          <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
        </div>
        <p className="progress-line">
          {message.completed ? (
            <span className="progress-check" aria-hidden>
              ✓
            </span>
          ) : (
            <Spinner size="sm" />
          )}
          <span>{message.completed ? "Results delivered via SSE" : message.text}</span>
        </p>
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <div className="bubble error">
        <div className="bubble-header">
          <span className="label">Error</span>
          <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
        </div>
        <p>{message.text}</p>
      </div>
    );
  }

  if (message.kind === "count-result") {
    return (
      <div className="bubble data">
        <div className="bubble-header">
          <span className="label">{message.label}</span>
          <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
        </div>
        <p className="count-result">
          <strong>{message.total}</strong> {domainItemLabel(message.domain)}
          {message.total === 1 ? "" : "s"} in the {message.domain} catalog.
        </p>      </div>
    );
  }

  return (
    <div className="bubble data">
      <div className="bubble-header">
        <span className="label">{message.label}</span>
        <time className="bubble-time">{formatTimestamp(message.timestamp)}</time>
      </div>
      <KnowledgeResultList domain={message.domain} items={message.items} />
    </div>
  );
}

function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  return <span className={`spinner spinner--${size}`} aria-hidden />;
}

function ProgressBubble({ mode }: { mode: ChatMode }) {
  const steps =
    mode === "async"
      ? ["Translating message", "Dispatching async job", "Generating reply"]
      : ["Translating message", "Fetching data", "Generating reply"];

  return (
    <div className="bubble progress" aria-live="polite" aria-busy="true">
      <div className="bubble-header">
        <span className="label">Working</span>
        <Spinner size="sm" />
      </div>
      <ul className="progress-steps">
        {steps.map((step, i) => (
          <li key={step} className="progress-step" style={{ animationDelay: `${i * 0.4}s` }}>
            <Spinner size="sm" />
            <span>{step}…</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
