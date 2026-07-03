import type { TokenUsage } from "@btl/core";

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function durationMs(totalDurationNs?: number): string {
  return totalDurationNs ? String(Math.round(totalDurationNs / 1_000_000)) : "—";
}

function UsageBlock({ label, usage }: { label: string; usage: TokenUsage }) {
  return (
    <div className="turn-meta-block">
      <p className="turn-meta-heading">{label}</p>
      <dl className="turn-meta">
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

export function TurnMeta({
  translatorUsage,
  agentUsage,
}: {
  translatorUsage: TokenUsage;
  agentUsage: TokenUsage;
}) {
  return (
    <div className="turn-meta-dual">
      <UsageBlock label="Translator (MCP routing)" usage={translatorUsage} />
      <UsageBlock label="User agent (chat reply)" usage={agentUsage} />
    </div>
  );
}
