import { describe, it, expect } from "vitest";
import type { ExecutionPlan } from "./execution-plan.js";
import {
  createExecution,
  updateStepStatus,
  getFailedSteps,
  getRetryableExecution,
  isExecutionComplete,
} from "./task-execution.js";

const samplePlan: ExecutionPlan = {
  summary: "Plan de test",
  steps: [
    { order: 1, agent: "backend", task: "Creer le service", dependsOn: [], parallel: false },
    { order: 2, agent: "frontend", task: "Creer le composant", dependsOn: [1], parallel: false },
    { order: 3, agent: "test", task: "Ecrire les tests", dependsOn: [1, 2], parallel: true },
  ],
  filesImpacted: ["src/service.ts", "web/component.tsx"],
  questions: [],
};

describe("createExecution", () => {
  it("doit creer une execution avec toutes les etapes en pending", () => {
    const execution = createExecution("task-1", samplePlan);

    expect(execution.taskId).toBe("task-1");
    expect(execution.id).toBeDefined();
    expect(execution.status).toBe("running");
    expect(execution.startedAt).toBeInstanceOf(Date);
    expect(execution.completedAt).toBeNull();
    expect(execution.plan).toBe(samplePlan);
    expect(execution.steps).toHaveLength(3);

    for (const step of execution.steps) {
      expect(step.status).toBe("pending");
      expect(step.output).toBeNull();
      expect(step.error).toBeNull();
      expect(step.startedAt).toBeNull();
      expect(step.completedAt).toBeNull();
      expect(step.attempt).toBe(1);
      expect(step.feedback).toBeNull();
    }
  });

  it("doit mapper les infos de chaque etape depuis le plan", () => {
    const execution = createExecution("task-1", samplePlan);

    expect(execution.steps[0].stepOrder).toBe(1);
    expect(execution.steps[0].agent).toBe("backend");
    expect(execution.steps[0].task).toBe("Creer le service");
    expect(execution.steps[1].stepOrder).toBe(2);
    expect(execution.steps[1].agent).toBe("frontend");
    expect(execution.steps[2].stepOrder).toBe(3);
    expect(execution.steps[2].agent).toBe("test");
  });
});

describe("updateStepStatus", () => {
  it("doit passer une etape en running avec une date de debut", () => {
    const execution = createExecution("task-1", samplePlan);
    const updated = updateStepStatus(execution, 1, "running");

    expect(updated.steps[0].status).toBe("running");
    expect(updated.steps[0].startedAt).toBeInstanceOf(Date);
    expect(updated.steps[0].completedAt).toBeNull();
    // Les autres etapes ne changent pas
    expect(updated.steps[1].status).toBe("pending");
    expect(updated.steps[2].status).toBe("pending");
  });

  it("doit passer une etape en completed avec output et date de fin", () => {
    const execution = createExecution("task-1", samplePlan);
    const running = updateStepStatus(execution, 1, "running");
    const completed = updateStepStatus(running, 1, "completed", "Resultat du service");

    expect(completed.steps[0].status).toBe("completed");
    expect(completed.steps[0].output).toBe("Resultat du service");
    expect(completed.steps[0].completedAt).toBeInstanceOf(Date);
  });

  it("doit passer une etape en failed avec erreur et date de fin", () => {
    const execution = createExecution("task-1", samplePlan);
    const running = updateStepStatus(execution, 2, "running");
    const failed = updateStepStatus(running, 2, "failed", undefined, "Timeout");

    expect(failed.steps[1].status).toBe("failed");
    expect(failed.steps[1].error).toBe("Timeout");
    expect(failed.steps[1].completedAt).toBeInstanceOf(Date);
  });

  it("ne doit pas modifier les autres etapes", () => {
    const execution = createExecution("task-1", samplePlan);
    const updated = updateStepStatus(execution, 2, "running");

    expect(updated.steps[0]).toBe(execution.steps[0]);
    expect(updated.steps[2]).toBe(execution.steps[2]);
  });
});

describe("getFailedSteps", () => {
  it("doit retourner les etapes en echec", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "completed", "ok");
    execution = updateStepStatus(execution, 2, "failed", undefined, "Erreur");
    execution = updateStepStatus(execution, 3, "failed", undefined, "Timeout");

    const failed = getFailedSteps(execution);
    expect(failed).toHaveLength(2);
    expect(failed[0].stepOrder).toBe(2);
    expect(failed[1].stepOrder).toBe(3);
  });

  it("doit retourner un tableau vide si aucune etape en echec", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "completed", "ok");

    expect(getFailedSteps(execution)).toHaveLength(0);
  });
});

describe("getRetryableExecution", () => {
  it("doit creer une nouvelle execution avec les etapes ciblees en pending", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "completed", "ok");
    execution = updateStepStatus(execution, 2, "failed", undefined, "Erreur");
    execution = updateStepStatus(execution, 3, "pending");

    const retry = getRetryableExecution(execution, [2], "Corrige le bug");

    expect(retry.id).not.toBe(execution.id);
    expect(retry.taskId).toBe("task-1");
    expect(retry.status).toBe("running");

    // Etape 1 : completed → reste completed
    expect(retry.steps[0].status).toBe("completed");
    expect(retry.steps[0].output).toBe("ok");

    // Etape 2 : failed → pending avec feedback
    expect(retry.steps[1].status).toBe("pending");
    expect(retry.steps[1].attempt).toBe(2);
    expect(retry.steps[1].feedback).toBe("Corrige le bug");
    expect(retry.steps[1].output).toBeNull();
    expect(retry.steps[1].error).toBeNull();

    // Etape 3 : pending → skipped (pas dans stepsToRetry et pas completed)
    expect(retry.steps[2].status).toBe("skipped");
  });

  it("doit incrementer le numero de tentative", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "failed", undefined, "Erreur");

    const retry1 = getRetryableExecution(execution, [1]);
    expect(retry1.steps[0].attempt).toBe(2);

    // Simuler un 2eme echec
    const retry1Failed = updateStepStatus(retry1, 1, "failed", undefined, "Encore echoue");
    const retry2 = getRetryableExecution(retry1Failed, [1]);
    expect(retry2.steps[0].attempt).toBe(3);
  });
});

describe("isExecutionComplete", () => {
  it("doit retourner true si toutes les etapes sont completed ou skipped", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "completed", "ok");
    execution = updateStepStatus(execution, 2, "completed", "ok");
    execution = updateStepStatus(execution, 3, "skipped");

    expect(isExecutionComplete(execution)).toBe(true);
  });

  it("doit retourner false si une etape est encore pending", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "completed", "ok");

    expect(isExecutionComplete(execution)).toBe(false);
  });

  it("doit retourner false si une etape est en running", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "running");

    expect(isExecutionComplete(execution)).toBe(false);
  });

  it("doit retourner false si une etape est en failed", () => {
    let execution = createExecution("task-1", samplePlan);
    execution = updateStepStatus(execution, 1, "completed", "ok");
    execution = updateStepStatus(execution, 2, "failed", undefined, "err");
    execution = updateStepStatus(execution, 3, "completed", "ok");

    expect(isExecutionComplete(execution)).toBe(false);
  });
});
