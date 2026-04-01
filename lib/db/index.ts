import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDbPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, ".maestro", "db.sqlite");
}

export function getDb(projectRoot?: string) {
  if (_db) return _db;

  const dbPath = getDbPath(projectRoot);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite, { schema });
  return _db;
}

export function initializeDatabase(projectRoot?: string) {
  const db = getDb(projectRoot);
  const dbPath = getDbPath(projectRoot);
  const sqlite = new Database(dbPath);

  // Create tables directly via SQL for initial setup
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      description   TEXT,
      config        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'idle',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS features (
      id            TEXT PRIMARY KEY,
      key           TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL,
      description   TEXT,
      status        TEXT NOT NULL DEFAULT 'backlog',
      agent_id      TEXT REFERENCES agents(id),
      branch        TEXT,
      priority      INTEGER DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id            TEXT PRIMARY KEY,
      agent_id      TEXT REFERENCES agents(id),
      feature_id    TEXT REFERENCES features(id),
      run_type      TEXT NOT NULL DEFAULT 'agent',
      status        TEXT NOT NULL DEFAULT 'queued',
      session_id    TEXT,
      prompt        TEXT,
      summary       TEXT,
      model         TEXT,
      input_tokens  INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      cost_usd      REAL DEFAULT 0,
      exit_code     INTEGER,
      pid           INTEGER,
      started_at    TEXT,
      finished_at   TEXT,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_runs_type ON runs(run_type);

    CREATE TABLE IF NOT EXISTS run_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id        TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      seq           INTEGER NOT NULL,
      type          TEXT NOT NULL,
      subtype       TEXT,
      data          TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_run_events_run_seq ON run_events(run_id, seq);
    CREATE INDEX IF NOT EXISTS idx_run_events_created ON run_events(created_at);

    CREATE TABLE IF NOT EXISTS skills (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      file_path     TEXT NOT NULL,
      checksum      TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      skill_id      TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      PRIMARY KEY (agent_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      owner_type    TEXT NOT NULL,
      agent_id      TEXT REFERENCES agents(id),
      feature_id    TEXT REFERENCES features(id),
      claude_session_id TEXT NOT NULL,
      last_run_id   TEXT REFERENCES runs(id),
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_agent_feature ON sessions(agent_id, feature_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_type);

    CREATE TABLE IF NOT EXISTS messages (
      id            TEXT PRIMARY KEY,
      content       TEXT NOT NULL,
      target_agent  TEXT REFERENCES agents(id),
      feature_id    TEXT REFERENCES features(id),
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TEXT NOT NULL,
      read_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL,
      model         TEXT NOT NULL,
      instructions  TEXT NOT NULL,
      skills        TEXT,
      rationale     TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TEXT NOT NULL,
      resolved_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key           TEXT PRIMARY KEY,
      value         TEXT NOT NULL
    );
  `);

  sqlite.close();
  return db;
}

export { schema };
