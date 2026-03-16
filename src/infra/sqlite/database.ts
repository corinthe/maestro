import Database from "better-sqlite3";
import { logger } from "../../shared/logger.js";

export function createDatabase(dbPath: string = "maestro.db"): Database.Database {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  logger.info({ dbPath }, "Base de donnees SQLite initialisee");

  return db;
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inbox',
      plan TEXT,
      branch TEXT,
      pr_url TEXT,
      agent_logs TEXT,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_executions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at DATETIME NOT NULL,
      completed_at DATETIME,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS step_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      agent TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      error TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      attempt INTEGER NOT NULL DEFAULT 1,
      feedback TEXT,
      FOREIGN KEY (execution_id) REFERENCES task_executions(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON task_executions(task_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_step_executions_execution_id ON step_executions(execution_id)
  `);

  logger.info("Migrations executees");
}
