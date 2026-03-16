import { describe, it, expect } from "vitest";
import { isPlanComplete } from "./is-plan-complete.js";
import { ExecutionPlan } from "./execution-plan.js";

function createTestPlan(): ExecutionPlan {
  return {
    summary: "Plan de test",
    steps: [
      { order: 1, agent: "backend", task: "Etape 1", dependsOn: [], parallel: false },
      { order: 2, agent: "frontend", task: "Etape 2", dependsOn: [1], parallel: false },
      { order: 3, agent: "test", task: "Etape 3", dependsOn: [2], parallel: false },
    ],
    filesImpacted: [],
    questions: [],
  };
}

describe("isPlanComplete", () => {
  it("doit retourner true quand toutes les etapes sont completees", () => {
    const plan = createTestPlan();

    expect(isPlanComplete(plan, [1, 2, 3])).toBe(true);
  });

  it("doit retourner false quand certaines etapes ne sont pas completees", () => {
    const plan = createTestPlan();

    expect(isPlanComplete(plan, [1, 2])).toBe(false);
  });

  it("doit retourner false quand aucune etape n'est completee", () => {
    const plan = createTestPlan();

    expect(isPlanComplete(plan, [])).toBe(false);
  });

  it("doit retourner true pour un plan a une seule etape completee", () => {
    const singleStepPlan: ExecutionPlan = {
      summary: "Plan simple",
      steps: [
        { order: 1, agent: "backend", task: "Unique etape", dependsOn: [], parallel: false },
      ],
      filesImpacted: [],
      questions: [],
    };

    expect(isPlanComplete(singleStepPlan, [1])).toBe(true);
  });
});
