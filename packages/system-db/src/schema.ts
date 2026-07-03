import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { getSystemDbPath } from "./path.js";

let db: Database.Database | null = null;

export function openSystemDb(): Database.Database {
  if (db) return db;

  const dbPath = getSystemDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      case_type TEXT NOT NULL,
      mode TEXT NOT NULL,
      user_message TEXT NOT NULL,
      event_json TEXT,
      ollama_model TEXT,
      ollama_api TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      agent_ack TEXT,
      mcp_tool TEXT,
      mcp_api TEXT,
      job_id TEXT,
      status TEXT NOT NULL,
      query_text TEXT,
      mcp_response_json TEXT,
      data_response_json TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_turns_session ON audit_turns(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_turns_created ON audit_turns(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_turns_job ON audit_turns(job_id);

    CREATE TABLE IF NOT EXISTS async_job_results (
      job_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      data_response_json TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_async_jobs_delivered ON async_job_results(delivered, created_at);
  `);

  migrateAuditTurns(db);

  return db;
}

function migrateAuditTurns(database: Database.Database): void {
  const columns = database.prepare(`PRAGMA table_info(audit_turns)`).all() as Array<{ name: string }>;
  const names = new Set(columns.map((c) => c.name));
  for (const [col, type] of [
    ["agent_message", "TEXT"],
    ["agent_model", "TEXT"],
    ["agent_input_tokens", "INTEGER"],
    ["agent_output_tokens", "INTEGER"],
  ] as const) {
    if (!names.has(col)) {
      database.exec(`ALTER TABLE audit_turns ADD COLUMN ${col} ${type}`);
    }
  }
}
