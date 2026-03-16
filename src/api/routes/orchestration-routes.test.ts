import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { createOrchestrationRoutes, type OrchestrationRouteDeps } from "./orchestration-routes.js";
import { errorHandler } from "../middleware/error-handler.js";
import type { Task } from "../../domain/task/task.js";
import type { TaskRepository } from "../../domain/task/task-repository.js";
import type { TaskQueue } from "../../domain/orchestration/task-queue.js";
import type { Worker } from "../../domain/orchestration/worker.js";

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test task",
    description: "Description",
    status: "ready",
    plan: JSON.stringify({ summary: "Plan", steps: [{ order: 1, agent: "backend", task: "do stuff", depends_on: [], parallel: false }], files_impacted: [], questions: [] }),
    branch: null,
    prUrl: null,
    agentLogs: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function createMockDeps(): OrchestrationRouteDeps {
  const tasks = new Map<string, Task>();

  const taskRepository: TaskRepository = {
    create: vi.fn((task: Task) => { tasks.set(task.id, task); return task; }),
    findById: vi.fn((id: string) => tasks.get(id) ?? null),
    findAll: vi.fn(() => [...tasks.values()]),
    findByStatus: vi.fn(() => []),
    update: vi.fn((task: Task) => { tasks.set(task.id, task); return task; }),
  };

  const taskQueue: TaskQueue = {
    push: vi.fn(),
    pop: vi.fn(() => undefined),
    peek: vi.fn(() => undefined),
    get length() { return 0; },
  };

  const worker = {
    executeApprovedTask: vi.fn(async () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(() => false),
    processTask: vi.fn(async () => {}),
  } as unknown as Worker;

  return { taskRepository, taskQueue, worker };
}

function createTestApp(deps: OrchestrationRouteDeps): express.Application {
  const app = express();
  app.use(express.json());
  app.use("/api/tasks", createOrchestrationRoutes(deps));
  app.use(errorHandler);
  return app;
}

describe("Orchestration routes", () => {
  let deps: OrchestrationRouteDeps;
  let app: express.Application;

  beforeEach(() => {
    deps = createMockDeps();
    app = createTestApp(deps);
  });

  describe("POST /api/tasks/:id/analyze", () => {
    it("doit lancer l'analyse d'une tache en statut inbox", async () => {
      const task = createTestTask({ status: "inbox" });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).post("/api/tasks/task-1/analyze");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("analyzing");
      expect(deps.worker.processTask).toHaveBeenCalled();
    });

    it("doit retourner 404 si la tache n'existe pas", async () => {
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const response = await request(app).post("/api/tasks/nonexistent/analyze");

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("TASK_NOT_FOUND");
    });

    it("doit retourner 422 si la tache n'est pas en statut inbox", async () => {
      const task = createTestTask({ status: "running" });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).post("/api/tasks/task-1/analyze");

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("TASK_INVALID_TRANSITION");
    });
  });

  describe("POST /api/tasks/:id/approve", () => {
    it("doit approuver une tache en statut ready", async () => {
      const task = createTestTask({ status: "ready" });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).post("/api/tasks/task-1/approve");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("approved");
      expect(deps.worker.executeApprovedTask).toHaveBeenCalled();
    });

    it("doit retourner 404 si la tache n'existe pas", async () => {
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const response = await request(app).post("/api/tasks/nonexistent/approve");

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("TASK_NOT_FOUND");
    });

    it("doit retourner 422 si la transition est invalide", async () => {
      const task = createTestTask({ status: "inbox" });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).post("/api/tasks/task-1/approve");

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("TASK_INVALID_TRANSITION");
    });
  });

  describe("POST /api/tasks/:id/cancel", () => {
    it("doit annuler une tache en cours d'execution", async () => {
      const task = createTestTask({ status: "running" });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).post("/api/tasks/task-1/cancel");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("failed");
    });

    it("doit retourner 404 si la tache n'existe pas", async () => {
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const response = await request(app).post("/api/tasks/nonexistent/cancel");

      expect(response.status).toBe(404);
    });

    it("doit retourner 422 si la tache ne peut pas etre annulee", async () => {
      const task = createTestTask({ status: "done" });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).post("/api/tasks/task-1/cancel");

      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/tasks/:id/logs", () => {
    it("doit retourner les logs des agents", async () => {
      const agentLogs = JSON.stringify({ "step-1-backend": "Code genere", "step-2-frontend": "Composant cree" });
      const task = createTestTask({ agentLogs });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).get("/api/tasks/task-1/logs");

      expect(response.status).toBe(200);
      expect(response.body.taskId).toBe("task-1");
      expect(response.body.logs["step-1-backend"]).toBe("Code genere");
    });

    it("doit retourner un objet vide si pas de logs", async () => {
      const task = createTestTask({ agentLogs: null });
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(task);

      const response = await request(app).get("/api/tasks/task-1/logs");

      expect(response.status).toBe(200);
      expect(response.body.logs).toEqual({});
    });

    it("doit retourner 404 si la tache n'existe pas", async () => {
      (deps.taskRepository.findById as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const response = await request(app).get("/api/tasks/nonexistent/logs");

      expect(response.status).toBe(404);
    });
  });
});
