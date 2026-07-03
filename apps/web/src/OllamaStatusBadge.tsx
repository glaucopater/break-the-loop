import { useCallback, useEffect, useState } from "react";
import type { OllamaStatus } from "@btl/core";

type Props = {
  apiBase: string;
};

export function OllamaStatusBadge({ apiBase }: Props) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(
    async (probeChat = false) => {
      if (probeChat) setProbing(true);
      else setLoading(true);
      try {
        const params = probeChat ? "?probeChat=true" : "";
        const response = await fetch(`${apiBase}/health/ollama${params}`);
        if (response.ok) {
          setStatus((await response.json()) as OllamaStatus);
        } else {
          setStatus(null);
        }
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
        setProbing(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    void refresh(false);
    const interval = setInterval(() => void refresh(false), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const state = loading
    ? "checking"
    : !status
      ? "offline"
      : status.ready
        ? "ready"
        : status.reachable
          ? "degraded"
          : "offline";

  const label =
    state === "checking"
      ? "Checking Ollama…"
      : state === "ready"
        ? `Ollama ready · ${status?.configuredAgentModel}`
        : state === "degraded"
          ? "Ollama degraded"
          : "Ollama offline";

  return (
    <div className="ollama-status">
      <button
        type="button"
        className={`ollama-pill ollama-pill--${state}`}
        onClick={() => setExpanded((v) => !v)}
        title="Click for Ollama API details"
      >
        <span className="ollama-dot" />
        {label}
      </button>

      {expanded && (
        <div className="ollama-details">
          {!status && !loading && <p>Could not reach the orchestrator Ollama health endpoint.</p>}
          {status && (
            <>
              <p>
                <strong>Base URL:</strong> {status.baseUrl}
              </p>
              <p>
                <strong>GET /api/tags:</strong>{" "}
                {status.tags.ok ? `ok (${status.tags.models.length} models)` : status.tags.error}
              </p>
              {!status.tags.ok && status.tags.error && <p className="ollama-error">{status.tags.error}</p>}
              {status.tags.ok && status.tags.models.length > 0 && (
                <p className="ollama-models">{status.tags.models.join(", ")}</p>
              )}
              <p>
                <strong>Translator model:</strong> {status.configuredModel}{" "}
                {status.modelAvailable ? "(available)" : "(missing)"}
              </p>
              <p>
                <strong>User agent model:</strong> {status.configuredAgentModel}{" "}
                {status.agentModelAvailable ? "(available)" : "(missing)"}
              </p>
              <p>
                <strong>POST /api/chat probe:</strong>{" "}
                {status.chat.ok
                  ? `ok · in ${status.chat.inputTokens ?? 0} / out ${status.chat.outputTokens ?? 0} tokens`
                  : status.chat.error ?? "not run (use deep check)"}
              </p>
              {status.chat.sample && (
                <p>
                  <strong>Sample reply:</strong> {status.chat.sample}
                </p>
              )}
            </>
          )}
          <button
            type="button"
            className="ollama-refresh"
            disabled={probing}
            onClick={() => void refresh(true)}
          >
            {probing ? "Probing models…" : "Deep check (chat probe)"}
          </button>
        </div>
      )}
    </div>
  );
}
