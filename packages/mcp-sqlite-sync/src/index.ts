#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { countDomain, searchDomain } from "@btl/db";

const server = new McpServer({
  name: "mcp-sqlite-sync",
  version: "0.0.1",
});

server.tool(
  "query_knowledge",
  "Search articles, products, or recipes — or count rows in a domain.",
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
  },
  async ({ domain, intent, query, limit }) => {
    const dataDomain = domain ?? "articles";
    const mode = intent ?? "search";

    if (mode === "count") {
      const total = countDomain(dataDomain);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, intent: "count", domain: dataDomain, total }),
          },
        ],
      };
    }

    if (!query?.trim()) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Query is required for search" }),
          },
        ],
      };
    }

    const rows = searchDomain(dataDomain, query, limit ?? 10);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            intent: "search",
            domain: dataDomain,
            count: rows.length,
            data: rows,
          }),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
