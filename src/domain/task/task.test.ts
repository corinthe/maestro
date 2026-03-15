import { describe, it, expect } from "vitest";
import { createTask } from "./task.js";

describe("createTask", () => {
  it("doit creer une tache en statut inbox", () => {
    const task = createTask("Ma tache", "Description de la tache");

    expect(task.title).toBe("Ma tache");
    expect(task.description).toBe("Description de la tache");
    expect(task.status).toBe("inbox");
    expect(task.id).toBeDefined();
    expect(task.plan).toBeNull();
    expect(task.branch).toBeNull();
    expect(task.prUrl).toBeNull();
    expect(task.agentLogs).toBeNull();
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);
  });

  it("doit generer un id unique pour chaque tache", () => {
    const task1 = createTask("Tache 1", "Desc 1");
    const task2 = createTask("Tache 2", "Desc 2");

    expect(task1.id).not.toBe(task2.id);
  });
});
