import express from "express";
import Database from "better-sqlite3";
import { createTaskRoutes } from "./routes/task-routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { SqliteTaskRepository } from "../infra/sqlite/sqlite-task-repository.js";
import { runMigrations } from "../infra/sqlite/database.js";

export interface AppDependencies {
  db?: Database.Database;
}

export function createApp(deps: AppDependencies = {}): express.Application {
  const db = deps.db ?? new Database(process.env.DB_PATH ?? "maestro.db");
  runMigrations(db);

  const taskRepository = new SqliteTaskRepository(db);

  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/tasks", createTaskRoutes(taskRepository));

  app.use(errorHandler);

  return app;
}
