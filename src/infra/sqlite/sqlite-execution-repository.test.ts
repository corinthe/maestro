import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "./database.js";
import { SqliteExecutionRepository } from "./sqlite-execution-repository.js";
import { createExecution, updateStepStatus } from "../../domain/orchestration/task-execution.js";
import type { ExecutionPlan } from "../../domain/orchestration/execution-plan.js";

const samplePlan: ExecutionPlan = {
  summary: "Plan de test",
  steps: [
    { order: 1, agent: "backend", task: "Creer le service", dependsOn: [], parallel: false },
    { order: 2, agent: "frontend", task: "Creer le composant", dependsOn: [1], parallel: false },
  ],
  filesImpacted: ["src/service.ts"],
  questions: ["Faut-il un cache?"],
};

describe("SqliteExecutionRepository", () => {
  let db: Database.Database;
  let repo: SqliteExecutionRepository;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    // Insert a fake task for FK
    db.prepare(
      "INSERT INTO tasks (id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("task-1", "Test", "Desc", "running", new Date().toISOString(), new Date().toISOString());

    repo = new SqliteExecutionRepository(db);
  });

  it("doit creer et retrouver une execution par id", () => {
    const execution = createExecution("task-1", samplePlan);
    repo.create(execution);

    const found = repo.findById(execution.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(execution.id);
    expect(found!.taskId).toBe("task-1");
    expect(found!.status).toBe("running");
    expect(found!.plan.summary).toBe("Plan de test");
    expect(found!.steps).toHaveLength(2);
    expect(found!.steps[0].agent).toBe("backend");
    expect(found!.steps[0].status).toBe("pending");
    expect(found!.steps[1].agent).toBe("frontend");
  });

  it("doit retourner null pour un id inexistant", () => {
    expect(repo.findById("inexistant")).toBeNull();
  });

  it("doit retrouver les executions par taskId", () => {
    const exec1 = createExecution("task-1", samplePlan);
    const exec2 = createExecution("task-1", samplePlan);
    repo.create(exec1);
    repo.create(exec2);

    const found = repo.findByTaskId("task-1");
    expect(found).toHaveLength(2);
  });

  it("doit retrouver la derniere execution par taskId", () => {
    const exec1 = createExecution("task-1", samplePlan);
    // Force an earlier date for exec1
    const exec1WithDate = { ...exec1, startedAt: new Date("2025-01-01T00:00:00Z") };
    repo.create(exec1WithDate);

    const exec2 = createExecution("task-1", samplePlan);
    const exec2WithDate = { ...exec2, startedAt: new Date("2025-06-01T00:00:00Z") };
    repo.create(exec2WithDate);

    const latest = repo.findLatestByTaskId("task-1");
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(exec2.id);
  });

  it("doit retourner null pour un taskId sans executions", () => {
    expect(repo.findLatestByTaskId("inexistant")).toBeNull();
  });

  it("doit mettre a jour une execution et ses etapes", () => {
    let execution = createExecution("task-1", samplePlan);
    repo.create(execution);

    execution = updateStepStatus(execution, 1, "running");
    execution = updateStepStatus(execution, 1, "completed", "Resultat OK");
    execution = { ...execution, status: "completed", completedAt: new Date() };
    repo.update(execution);

    const found = repo.findById(execution.id);
    expect(found!.status).toBe("completed");
    expect(found!.completedAt).not.toBeNull();
    expect(found!.steps[0].status).toBe("completed");
    expect(found!.steps[0].output).toBe("Resultat OK");
    expect(found!.steps[0].completedAt).not.toBeNull();
  });

  it("doit persister le feedback lors de la mise a jour", () => {
    let execution = createExecution("task-1", samplePlan);
    repo.create(execution);

    const stepsWithFeedback = execution.steps.map((s, i) =>
      i === 0 ? { ...s, feedback: "Corrige ce bug", attempt: 2 } : s
    );
    execution = { ...execution, steps: stepsWithFeedback };
    repo.update(execution);

    const found = repo.findById(execution.id);
    expect(found!.steps[0].feedback).toBe("Corrige ce bug");
    expect(found!.steps[0].attempt).toBe(2);
  });
});
