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

  logger.info("Migrations executees");
}
