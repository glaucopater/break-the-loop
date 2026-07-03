# Break the Loop

POC demonstrating an architecture where the LLM agent **only translates** user requests into atomic events. Tool execution and data delivery happen outside the agent loop, with Ollama token usage monitored per turn.

## Architecture

```
User (SPA) → Orchestrator → Ollama (translate to AtomicEvent)
                         → MCP Sync/Async → SQLite
                         → User (data direct or via SSE)
```

### Case A — Sync (`QUERY_SYNC`)

1. User sends a message in the chat UI.
2. Ollama returns a `QUERY_SYNC` JSON event (input/output tokens recorded).
3. Orchestrator calls the **sync MCP** (`query_knowledge`), which returns full article rows.
4. Data is rendered in the UI **without** passing through the agent again.

### Case B — Async (`QUERY_ASYNC`)

1. User sends a message (or selects Async mode / `[async]` prefix).
2. Ollama returns a `QUERY_ASYNC` JSON event.
3. Orchestrator calls the **async MCP** (`query_knowledge_async`), which returns `{ success, jobId }` only.
4. Background query runs in the MCP process; completion is pushed to the SPA via **SSE** (`GET /events/:sessionId`).

## Prerequisites

- **Node.js 20+**
- **Yarn 4** (bundled via `packageManager` field)
- **Ollama** running locally with your model pulled:

```bash
ollama pull gemma4:e2b
```

## Configuration

Copy the example env file (or let `yarn dev` create it automatically):

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit [`.env`](.env) at the repo root:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `gemma4:e2b` | Model used for event translation |
| `OLLAMA_PROBE_CHAT` | `true` | Run POST `/api/chat` on `/health/ollama` |
| `PORT` | `3001` | Orchestrator port |

### Ollama API status check

The orchestrator verifies Ollama with the same endpoints you would use manually:

```bash
# Tags — is the API up and which models are available?
curl --request GET --url http://localhost:11434/api/tags

# Chat probe — is inference working for the configured model?
curl --request POST \
  --url http://localhost:11434/api/chat \
  --header 'content-type: application/json' \
  --data '{
    "model": "gemma4:e2b",
    "messages": [{ "role": "user", "content": "Reply with exactly: ok" }],
    "stream": false
  }'
```

App endpoints:

| Route | Purpose |
|-------|---------|
| `GET /health` | Quick status (DB + Ollama reachability/model availability) |
| `GET /health/ollama` | Full Ollama check: `/api/tags` + optional `/api/chat` probe |

The SPA shows an **Ollama status pill** in the header (click for details, auto-refreshes every 30s).

## Quick start

```bash
yarn install
yarn dev
```

`yarn dev` seeds the database, builds all packages, and starts the orchestrator + SPA.

For a manual workflow:

```bash
yarn install
yarn seed
yarn build
yarn dev
```

- **SPA:** http://localhost:5173
- **API:** http://localhost:3001
- **Health:** http://localhost:3001/health

`yarn dev` runs the orchestrator and Vite dev server together. The SPA proxies `/api/*` to the backend.

## Example prompts

- `find articles about caching` — auto mode (sync unless you ask for async)
- `[sync] search for redis`
- `[async] find articles about events`

## Monorepo layout

| Package | Role |
|---------|------|
| `apps/web` | Minimal React chat SPA + token panel |
| `apps/server` | Fastify orchestrator, Ollama translator, SSE hub |
| `packages/core` | Shared types (`AtomicEvent`, `TokenUsage`) |
| `packages/db` | SQLite schema, seed data, search helper |
| `packages/mcp-sqlite-sync` | Case A MCP server (stdio) |
| `packages/mcp-sqlite-async` | Case B MCP server (stdio) |
| `data/knowledge.db` | Seeded SQLite database |

## Token monitoring

Each `/api/chat` turn calls Ollama once with `stream: false`. The orchestrator reads `prompt_eval_count` (input) and `eval_count` (output) from the response and exposes them in the UI sidebar. Tool result payloads are **not** sent back to Ollama, so token usage reflects translation only.

## License

MIT
