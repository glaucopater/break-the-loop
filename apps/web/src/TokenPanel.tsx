import type { TokenUsage } from "@btl/core";
import { durationMs, formatTimestamp } from "./format";

type Props = {
  lastTranslatorTurn: TokenUsage | null;
  lastAgentTurn: TokenUsage | null;
  cumulativeInput: number;
  cumulativeOutput: number;
  turnCount: number;
};

function TurnBlock({ title, usage }: { title: string; usage: TokenUsage }) {
  return (
    <div className="last-turn-block">
      <h4>{title}</h4>
      <dl>
        <div>
          <dt>Model</dt>
          <dd>{usage.model}</dd>
        </div>
        <div>
          <dt>Input tokens</dt>
          <dd>{usage.inputTokens}</dd>
        </div>
        <div>
          <dt>Output tokens</dt>
          <dd>{usage.outputTokens}</dd>
        </div>
        <div>
          <dt>Duration (ms)</dt>
          <dd>{durationMs(usage.totalDurationNs)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function TokenPanel({
  lastTranslatorTurn,
  lastAgentTurn,
  cumulativeInput,
  cumulativeOutput,
  turnCount,
}: Props) {
  const timestamp = lastAgentTurn?.timestamp ?? lastTranslatorTurn?.timestamp;
  const translatorModel = lastTranslatorTurn?.model ?? "translator model";
  const agentModel = lastAgentTurn?.model ?? "agent model";

  return (
    <aside className="token-panel">
      <h2>Token usage</h2>
      <p className="panel-desc">
        Translator ({translatorModel}) + user agent ({agentModel}). MCP payloads still bypass the
        re-ingest loop.
      </p>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Turns</span>
          <span className="stat-value">{turnCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Cumulative input</span>
          <span className="stat-value">{cumulativeInput}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Cumulative output</span>
          <span className="stat-value">{cumulativeOutput}</span>
        </div>
      </div>

      {(lastTranslatorTurn || lastAgentTurn) && (
        <div className="last-turn">
          <h3>Last turn {timestamp ? `· ${formatTimestamp(timestamp)}` : ""}</h3>
          {lastTranslatorTurn && <TurnBlock title="Translator (MCP)" usage={lastTranslatorTurn} />}
          {lastAgentTurn && <TurnBlock title="User agent (chat)" usage={lastAgentTurn} />}
        </div>
      )}
    </aside>
  );
}
