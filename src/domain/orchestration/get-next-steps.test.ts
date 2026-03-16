import { describe, it, expect } from "vitest";
import { getNextSteps } from "./get-next-steps.js";
import { ExecutionPlan } from "./execution-plan.js";

function createTestPlan(): ExecutionPlan {
  return {
    summary: "Plan de test",
    steps: [
      { order: 1, agent: "backend", task: "Etape 1", dependsOn: [], parallel: false },
      { order: 2, agent: "frontend", task: "Etape 2", dependsOn: [1], parallel: false },
      { order: 3, agent: "test", task: "Etape 3", dependsOn: [1], parallel: true },
      { order: 4, agent: "devops", task: "Etape 4", dependsOn: [2, 3], parallel: false },
    ],
    filesImpacted: [],
    questions: [],
  };
}

describe("getNextSteps", () => {
  it("doit retourner les etapes sans dependances quand aucune etape n'est completee", () => {
    const plan = createTestPlan();

    const next = getNextSteps(plan, []);

    expect(next).toHaveLength(1);
    expect(next[0].order).toBe(1);
  });

  it("doit retourner les etapes dont toutes les dependances sont completees", () => {
    const plan = createTestPlan();

    const next = getNextSteps(plan, [1]);

    expect(next).toHaveLength(2);
    expect(next.map(s => s.order)).toEqual([2, 3]);
  });

  it("doit retourner plusieurs etapes paralleles quand leurs dependances sont satisfaites", () => {
    const plan = createTestPlan();

    const next = getNextSteps(plan, [1]);

    expect(next).toHaveLength(2);
    expect(next[0].order).toBe(2);
    expect(next[1].order).toBe(3);
  });

  it("doit retourner un tableau vide quand toutes les etapes sont completees", () => {
    const plan = createTestPlan();

    const next = getNextSteps(plan, [1, 2, 3, 4]);

    expect(next).toEqual([]);
  });

  it("doit ne pas retourner une etape si une de ses dependances n'est pas completee", () => {
    const plan = createTestPlan();

    const next = getNextSteps(plan, [1, 2]);

    // Etape 4 depend de 2 et 3, mais 3 n'est pas completee
    expect(next.map(s => s.order)).toEqual([3]);
  });
});
