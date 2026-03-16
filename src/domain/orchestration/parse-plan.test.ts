import { describe, it, expect } from "vitest";
import { parsePlan } from "./parse-plan.js";
import { InvalidPlanError } from "./errors.js";

const validPlanJson = JSON.stringify({
  summary: "Plan de migration de la base de donnees",
  steps: [
    {
      order: 1,
      agent: "backend",
      task: "Creer le schema de migration",
      depends_on: [],
      parallel: false,
    },
    {
      order: 2,
      agent: "backend",
      task: "Implementer les repositories",
      depends_on: [1],
      parallel: false,
    },
    {
      order: 3,
      agent: "test",
      task: "Ecrire les tests d'integration",
      depends_on: [2],
      parallel: true,
    },
  ],
  files_impacted: ["src/infra/db/schema.ts", "src/domain/task/task-repository.ts"],
  questions: ["Faut-il migrer les donnees existantes ?"],
});

describe("parsePlan", () => {
  it("doit parser un plan valide avec tous les champs", () => {
    const plan = parsePlan(validPlanJson);

    expect(plan.summary).toBe("Plan de migration de la base de donnees");
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].order).toBe(1);
    expect(plan.steps[0].agent).toBe("backend");
    expect(plan.steps[0].task).toBe("Creer le schema de migration");
    expect(plan.steps[0].dependsOn).toEqual([]);
    expect(plan.steps[0].parallel).toBe(false);
    expect(plan.steps[1].dependsOn).toEqual([1]);
    expect(plan.steps[2].parallel).toBe(true);
    expect(plan.filesImpacted).toEqual([
      "src/infra/db/schema.ts",
      "src/domain/task/task-repository.ts",
    ]);
    expect(plan.questions).toEqual(["Faut-il migrer les donnees existantes ?"]);
  });

  it("doit parser un plan minimal avec uniquement les champs requis", () => {
    const minimalJson = JSON.stringify({
      summary: "Plan minimal",
      steps: [
        {
          order: 1,
          agent: "backend",
          task: "Faire quelque chose",
        },
      ],
    });

    const plan = parsePlan(minimalJson);

    expect(plan.summary).toBe("Plan minimal");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].dependsOn).toEqual([]);
    expect(plan.steps[0].parallel).toBe(false);
    expect(plan.filesImpacted).toEqual([]);
    expect(plan.questions).toEqual([]);
  });

  it("doit lancer InvalidPlanError si le JSON est invalide", () => {
    expect(() => parsePlan("ceci n'est pas du json")).toThrow(InvalidPlanError);
    expect(() => parsePlan("{invalid}")).toThrow(InvalidPlanError);
  });

  it("doit lancer InvalidPlanError si le champ summary est manquant", () => {
    const noSummary = JSON.stringify({
      steps: [{ order: 1, agent: "backend", task: "Faire quelque chose" }],
    });

    expect(() => parsePlan(noSummary)).toThrow(InvalidPlanError);
  });

  it("doit lancer InvalidPlanError si le champ steps est manquant", () => {
    const noSteps = JSON.stringify({
      summary: "Un plan sans etapes",
    });

    expect(() => parsePlan(noSteps)).toThrow(InvalidPlanError);
  });

  it("doit lancer InvalidPlanError si le tableau steps est vide", () => {
    const emptySteps = JSON.stringify({
      summary: "Un plan avec un tableau vide",
      steps: [],
    });

    expect(() => parsePlan(emptySteps)).toThrow(InvalidPlanError);
  });

  it("doit mapper depends_on vers dependsOn", () => {
    const json = JSON.stringify({
      summary: "Plan avec dependances",
      steps: [
        { order: 1, agent: "backend", task: "Etape 1" },
        { order: 2, agent: "frontend", task: "Etape 2", depends_on: [1] },
        { order: 3, agent: "test", task: "Etape 3", depends_on: [1, 2] },
      ],
    });

    const plan = parsePlan(json);

    expect(plan.steps[0].dependsOn).toEqual([]);
    expect(plan.steps[1].dependsOn).toEqual([1]);
    expect(plan.steps[2].dependsOn).toEqual([1, 2]);
  });

  it("doit mapper files_impacted vers filesImpacted", () => {
    const json = JSON.stringify({
      summary: "Plan avec fichiers",
      steps: [{ order: 1, agent: "backend", task: "Etape 1" }],
      files_impacted: ["src/index.ts", "src/app.ts"],
    });

    const plan = parsePlan(json);

    expect(plan.filesImpacted).toEqual(["src/index.ts", "src/app.ts"]);
  });
});
