import type { AuditTurn } from "@btl/core";
import {
  formatStageTokens,
  getTokenStageHints,
  getTurnTokenFlow,
  type StageTokens,
} from "./auditTokens";

type Props = {
  turn: AuditTurn;
  compact?: boolean;
};

export function AuditTokenFlow({ turn, compact }: Props) {
  const flow = getTurnTokenFlow(turn);
  const hints = getTokenStageHints(turn);
  const translatorModel = turn.ollamaModel ?? "translator model";
  const agentModel = turn.agentModel ?? "agent model";

  if (compact) {
    return (
      <div className="token-flow-compact">
        <TokenFlowLine stage="Translator" tokens={flow.translator} hint={hints.translator} />
        <TokenFlowLine stage="User agent" tokens={flow.userAgent} hint={hints.userAgent} />
        <TokenFlowLine
          stage="Loop"
          tokens={flow.agentLoop}
          hint={hints.agentLoop}
          extra={
            flow.tokensAvoidedEstimate > 0
              ? `~${flow.tokensAvoidedEstimate} saved`
              : "bypassed"
          }
        />
        <TokenFlowLine
          stage="MCP"
          tokens={flow.mcp}
          hint={hints.mcp}
          extra={
            flow.mcpPayloadChars > 0
              ? `${flow.mcpPayloadChars.toLocaleString()} chars`
              : undefined
          }
        />
      </div>
    );
  }

  const agentLoopNotes =
    flow.tokensAvoidedEstimate > 0
      ? `${hints.agentLoop} ~${flow.tokensAvoidedEstimate} input tokens avoided (payload ÷ 4 estimate).`
      : hints.agentLoop;

  return (
    <div className="token-flow-panel">
      <h4>Token flow</h4>
      <p className="token-flow-desc">
        Two models per turn: <strong>{translatorModel}</strong> translates for MCP;{" "}
        <strong>{agentModel}</strong> replies to the user from a compact summary. Full MCP payloads
        still bypass the re-ingest loop.
      </p>
      <table className="token-flow-table">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Input tokens</th>
            <th>Output tokens</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <TokenFlowRow
            stage="Translator → MCP"
            tokens={flow.translator}
            notes={hints.translator}
            model={turn.ollamaModel ?? undefined}
          />
          <TokenFlowRow
            stage="User agent (chat)"
            tokens={flow.userAgent}
            notes={hints.userAgent}
            model={turn.agentModel ?? undefined}
          />
          <TokenFlowRow
            stage="Re-ingest loop (skipped)"
            tokens={flow.agentLoop}
            notes={agentLoopNotes}
            highlight="bypassed"
          />
          <TokenFlowRow stage="MCP (tool I/O)" tokens={flow.mcp} notes={hints.mcp} />
        </tbody>
      </table>
    </div>
  );
}

function TokenFlowLine({
  stage,
  tokens,
  hint,
  extra,
}: {
  stage: string;
  tokens: StageTokens;
  hint: string;
  extra?: string;
}) {
  return (
    <div className="token-flow-line" title={hint}>
      <span className="token-flow-stage">{stage}</span>
      <span className="token-flow-values">{formatStageTokens(tokens)}</span>
      {extra ? <span className="token-flow-extra">{extra}</span> : null}
    </div>
  );
}

function TokenFlowRow({
  stage,
  tokens,
  notes,
  model,
  highlight,
}: {
  stage: string;
  tokens: StageTokens;
  notes: string;
  model?: string;
  highlight?: string;
}) {
  return (
    <tr>
      <td>
        <strong>{stage}</strong>
        {model ? <span className="token-flow-model">{model}</span> : null}
        {highlight ? <span className="token-flow-tag">{highlight}</span> : null}
      </td>
      <td className="token-flow-num">{tokens.input}</td>
      <td className="token-flow-num">{tokens.output}</td>
      <td className="token-flow-notes">{notes}</td>
    </tr>
  );
}
