import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { KnowledgeDomain, KnowledgeIntent, KnowledgeRecord } from "@btl/core";
import { pushAsyncResult } from "../events/sseHub.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..", "..");

type SyncSearchResult = {
  success: boolean;
  intent: "search";
  domain: KnowledgeDomain;
  count: number;
  data: KnowledgeRecord[];
};

type SyncCountResult = {
  success: boolean;
  intent: "count";
  domain: KnowledgeDomain;
  total: number;
};

type AsyncQueryAck = {
  success: boolean;
  jobId?: string;
  error?: string;
};

type AsyncJobComplete = {
  type: "ASYNC_JOB_COMPLETE";
  jobId: string;
  sessionId: string;
  intent: KnowledgeIntent;
  domain: KnowledgeDomain;
  query?: string;
  data?: KnowledgeRecord[];
  total?: number;
};

let syncClient: Client | null = null;
let asyncClient: Client | null = null;

function parseToolText<T>(content: unknown): T {
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("MCP tool returned empty content");
  }
  const first = content[0] as { type?: string; text?: string };
  if (first.type !== "text" || !first.text) {
    throw new Error("MCP tool returned unexpected content format");
  }
  return JSON.parse(first.text) as T;
}

async function getSyncClient(): Promise<Client> {
  if (syncClient) return syncClient;

  const transport = new StdioClientTransport({
    command: "yarn",
    args: ["node", join(repoRoot, "packages", "mcp-sqlite-sync", "dist", "index.js")],
    cwd: repoRoot,
  });

  const client = new Client({ name: "btl-orchestrator-sync", version: "0.0.1" });
  await client.connect(transport);
  syncClient = client;
  return client;
}

async function getAsyncClient(): Promise<Client> {
  if (asyncClient) return asyncClient;

  const transport = new StdioClientTransport({
    command: "yarn",
    args: ["node", join(repoRoot, "packages", "mcp-sqlite-async", "dist", "index.js")],
    cwd: repoRoot,
  });

  const client = new Client({ name: "btl-orchestrator-async", version: "0.0.1" });
  await client.connect(transport);

  client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
    const raw = notification.params.data;
    if (typeof raw !== "string") return;
    try {
      const payload = JSON.parse(raw) as AsyncJobComplete;
      if (payload.type === "ASYNC_JOB_COMPLETE") {
        pushAsyncResult(payload.sessionId, {
          type: "ASYNC_RESULT",
          jobId: payload.jobId,
          domain: payload.domain,
          intent: payload.intent,
          query: payload.query,
          data: payload.data,
          total: payload.total,
        });
      }
    } catch {
      // ignore non-JSON logging messages
    }
  });

  asyncClient = client;
  return client;
}

export async function queryKnowledgeSync(
  domain: KnowledgeDomain,
  query: string,
  limit?: number,
): Promise<KnowledgeRecord[]> {
  const client = await getSyncClient();
  const result = await client.callTool({
    name: "query_knowledge",
    arguments: { domain, intent: "search", query, limit },
  });
  const parsed = parseToolText<SyncSearchResult>(result.content);
  if (!parsed.success) {
    throw new Error("Sync query failed");
  }
  return parsed.data;
}

export async function countKnowledgeSync(domain: KnowledgeDomain): Promise<number> {
  const client = await getSyncClient();
  const result = await client.callTool({
    name: "query_knowledge",
    arguments: { domain, intent: "count" },
  });
  const parsed = parseToolText<SyncCountResult>(result.content);
  if (!parsed.success) {
    throw new Error("Sync count failed");
  }
  return parsed.total;
}

export async function queryKnowledgeAsync(
  domain: KnowledgeDomain,
  query: string,
  sessionId: string,
  limit?: number,
): Promise<AsyncQueryAck> {
  const client = await getAsyncClient();
  const result = await client.callTool({
    name: "query_knowledge_async",
    arguments: { domain, intent: "search", query, limit, sessionId, delayMs: 1500 },
  });
  return parseToolText<AsyncQueryAck>(result.content);
}

export async function countKnowledgeAsync(
  domain: KnowledgeDomain,
  sessionId: string,
): Promise<AsyncQueryAck> {
  const client = await getAsyncClient();
  const result = await client.callTool({
    name: "query_knowledge_async",
    arguments: { domain, intent: "count", sessionId, delayMs: 1500 },
  });
  return parseToolText<AsyncQueryAck>(result.content);
}

export async function closeMcpClients(): Promise<void> {
  if (syncClient) {
    await syncClient.close();
    syncClient = null;
  }
  if (asyncClient) {
    await asyncClient.close();
    asyncClient = null;
  }
}
