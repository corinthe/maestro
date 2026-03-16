import { existsSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { createTaskRoutes } from "./routes/task-routes.js";
import { createAgentRoutes } from "./routes/agent-routes.js";
import { createOrchestrationRoutes } from "./routes/orchestration-routes.js";
import { createProjectRoutes } from "./routes/project-routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { SqliteTaskRepository } from "../infra/sqlite/sqlite-task-repository.js";
import { runMigrations } from "../infra/sqlite/database.js";
import type { AgentRegistry } from "../domain/agent/agent-registry.js";
import type { ProjectLoader } from "../domain/project/project-loader.js";
import type { TaskQueue } from "../domain/orchestration/task-queue.js";
import type { Worker } from "../domain/orchestration/worker.js";

export interface AppDependencies {
  db?: Database.Database;
  agentRegistry?: AgentRegistry;
  projectLoader?: ProjectLoader;
  taskQueue?: TaskQueue;
  worker?: Worker;
  workingDir?: string;
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

  if (deps.agentRegistry) {
    app.use("/api/agents", createAgentRoutes(deps.agentRegistry));
  }

  if (deps.taskQueue && deps.worker) {
    app.use("/api/tasks", createOrchestrationRoutes({
      taskRepository,
      taskQueue: deps.taskQueue,
      worker: deps.worker,
    }));
  }

  if (deps.projectLoader && deps.agentRegistry) {
    app.use("/api/project", createProjectRoutes({
      projectLoader: deps.projectLoader,
      agentRegistry: deps.agentRegistry,
      taskRepository,
      workingDir: deps.workingDir ?? process.cwd(),
    }));
  }

  app.use(errorHandler);

  // Serving statique du frontend en production
  const serveStatic = process.env.SERVE_STATIC !== "false";
  const webDistPath = join(process.cwd(), "web", "dist");

  if (serveStatic && existsSync(webDistPath)) {
    app.use(express.static(webDistPath));

    // SPA fallback: toute route non-API retourne index.html
    app.get("*", (_req, res) => {
      res.sendFile(join(webDistPath, "index.html"));
    });
  }

  return app;
}
