#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { countDomain, searchDomain } from "@btl/db";
import { storeAsyncJobResult } from "@btl/system-db";

const server = new McpServer({
  name: "mcp-sqlite-async",
  version: "0.0.1",
});

const pendingJobs = new Map<string, ReturnType<typeof setTimeout>>();

server.tool(
  "query_knowledge_async",
  "Submit an async search or count across articles, products, or recipes.",
  {
    domain: z
      .enum(["articles", "products", "recipes"])
      .optional()
      .describe("Data domain (default: articles)"),
    intent: z
      .enum(["search", "count"])
      .optional()
      .describe("search matches rows; count returns total rows in the domain"),
    query: z.string().optional().describe("Search terms (required when intent is search)"),
    limit: z.number().int().positive().max(50).optional().describe("Max results for search"),
    sessionId: z.string().describe("Session id for routing async results"),
    delayMs: z.number().int().nonnegative().optional().describe("Simulated async delay"),
  },
  async ({ domain, intent, query, limit, sessionId, delayMs }) => {
    const dataDomain = domain ?? "articles";
    const mode = intent ?? "search";

    if (mode === "search" && !query?.trim()) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Query is required for search" }),
          },
        ],
      };
    }

    const jobId = randomUUID();
    const delay = delayMs ?? 1500;

    const timeout = setTimeout(() => {
      pendingJobs.delete(jobId);
      if (mode === "count") {
        const total = countDomain(dataDomain);
        storeAsyncJobResult({ jobId, sessionId, intent: "count", domain: dataDomain, total });
      } else {
        const rows = searchDomain(dataDomain, query!, limit ?? 10);
        storeAsyncJobResult({
          jobId,
          sessionId,
          intent: "search",
          domain: dataDomain,
          query: query!,
          data: rows,
        });
      }
    }, delay);

    pendingJobs.set(jobId, timeout);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, jobId, intent: mode, domain: dataDomain }),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
