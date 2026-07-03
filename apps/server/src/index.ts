import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { getDbPath } from "@btl/db";
import type { ChatResponse } from "@btl/core";
import { mapAuditTurn } from "@btl/core";
import {
  createAuditTurn,
  createFailedAuditTurn,
  listAuditTurns,
  openSystemDb,
} from "@btl/system-db";
import { translateToEvent } from "./ollama/translator.js";
import { generateAgentReply } from "./ollama/agent.js";
import { buildOrchestrationSummary } from "./ollama/summary.js";
import { getOllamaStatus, OLLAMA_BASE_URL, startOllamaHealthWatcher } from "./ollama/health.js";
import { dispatchChat } from "./events/dispatcher.js";
import { registerSseClient } from "./events/sseHub.js";
import { startAsyncJobWatcher, stopAsyncJobWatcher } from "./events/jobWatcher.js";
import { closeMcpClients } from "./mcp/client.js";
import { recordTurnTokenUsage } from "./tokens/store.js";
import type { ChatMode } from "@btl/core";

const PORT = Number(process.env.PORT ?? 3001);

openSystemDb();
startAsyncJobWatcher();
startOllamaHealthWatcher();

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
});

app.get("/health", async () => {
  const ollamaStatus = await getOllamaStatus({ probeChat: false });
  const db = existsSync(getDbPath());
  return {
    status: ollamaStatus.ready && db ? "ok" : "degraded",
    ollama: ollamaStatus.reachable,
    ollamaReady: ollamaStatus.ready,
    ollamaModel: ollamaStatus.configuredModel,
    ollamaAgentModel: ollamaStatus.configuredAgentModel,
    ollamaModelAvailable: ollamaStatus.modelAvailable,
    ollamaAgentModelAvailable: ollamaStatus.agentModelAvailable,
    database: db,
    dbPath: getDbPath(),
  };
});

app.get<{ Querystring: { probeChat?: string } }>("/health/ollama", async (request) => {
  const probeChat = request.query.probeChat === "true";
  return getOllamaStatus({ probeChat });
});

app.get<{ Querystring: { sessionId?: string; limit?: string } }>("/audit/turns", async (request) => {
  const limit = request.query.limit ? Number(request.query.limit) : 100;
  const rows = listAuditTurns({
    sessionId: request.query.sessionId,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  return { turns: rows.map(mapAuditTurn) };
});

app.get<{ Params: { sessionId: string } }>("/events/:sessionId", async (request, reply) => {
  const { sessionId } = request.params;

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  registerSseClient(sessionId, reply.raw);

  return reply;
});

app.post<{
  Body: { message?: string; sessionId?: string; mode?: ChatMode };
}>("/chat", async (request, reply) => {
  const message = request.body.message?.trim();
  if (!message) {
    return reply.status(400).send({ error: "message is required" });
  }

  const sessionId = request.body.sessionId ?? randomUUID();
  const mode: ChatMode = request.body.mode ?? "auto";
  const turnId = randomUUID();

  try {
    const { raw, tokenUsage: translatorUsage } = await translateToEvent(
      message,
      mode === "auto" ? undefined : mode,
    );
    const dispatch = await dispatchChat({ sessionId, message, mode, rawEventJson: raw });

    const orchestrationSummary = buildOrchestrationSummary(dispatch);

    const { message: agentMessage, tokenUsage: agentUsage } = await generateAgentReply({
      userMessage: message,
      orchestrationSummary,
    });

    const tokenSummary = recordTurnTokenUsage(sessionId, translatorUsage, agentUsage);

    const response: ChatResponse = {
      ...dispatch,
      agentMessage,
      tokenUsage: translatorUsage,
      agentTokenUsage: agentUsage,
      tokenSummary: {
        cumulativeInputTokens: tokenSummary.cumulativeInputTokens,
        cumulativeOutputTokens: tokenSummary.cumulativeOutputTokens,
        turnCount: tokenSummary.turnCount,
        lastTranslatorTurn: tokenSummary.lastTranslatorTurn,
        lastAgentTurn: tokenSummary.lastAgentTurn,
      },
    };

    createAuditTurn({
      id: turnId,
      sessionId,
      caseType: response.event.type,
      mode,
      userMessage: message,
      event: response.event,
      translatorUsage,
      agentUsage,
      ollamaApi: OLLAMA_BASE_URL,
      response,
    });

    return { ...response, turnId };
  } catch (error) {
    const err = error instanceof Error ? error.message : "Unknown error";
    createFailedAuditTurn({
      id: turnId,
      sessionId,
      mode,
      userMessage: message,
      ollamaApi: OLLAMA_BASE_URL,
      errorMessage: err,
    });
    request.log.error(error);
    return reply.status(500).send({ error: err, sessionId, turnId });
  }
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[server] listening on http://localhost:${PORT}`);
    app.log.info(`Server listening on http://localhost:${PORT}`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "EADDRINUSE") {
      console.error(`[server] port ${PORT} is already in use — stop the other process or set PORT`);
    } else {
      console.error("[server] failed to start:", err);
    }
    process.exit(1);
  }
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    stopAsyncJobWatcher();
    await closeMcpClients();
    await app.close();
    process.exit(0);
  });
}
