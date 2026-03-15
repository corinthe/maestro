import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SqliteTaskRepository } from "./sqlite-task-repository.js";
import { runMigrations } from "./database.js";
import { createTask } from "../../domain/task/task.js";
import type { Task } from "../../domain/task/task.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

describe("SqliteTaskRepository", () => {
  let db: Database.Database;
  let repo: SqliteTaskRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SqliteTaskRepository(db);
  });

  describe("create", () => {
    it("doit creer une tache et la persister", () => {
      const task = createTask("Ma tache", "Description");
      repo.create(task);

      const found = repo.findById(task.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe("Ma tache");
      expect(found!.description).toBe("Description");
      expect(found!.status).toBe("inbox");
    });
  });

  describe("findById", () => {
    it("doit retourner null si la tache n'existe pas", () => {
      const found = repo.findById("inexistant");
      expect(found).toBeNull();
    });

    it("doit retrouver une tache par son id", () => {
      const task = createTask("Tache", "Desc");
      repo.create(task);

      const found = repo.findById(task.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(task.id);
    });
  });

  describe("findAll", () => {
    it("doit retourner une liste vide si pas de taches", () => {
      const tasks = repo.findAll();
      expect(tasks).toEqual([]);
    });

    it("doit retourner toutes les taches", () => {
      repo.create(createTask("Tache 1", "Desc 1"));
      repo.create(createTask("Tache 2", "Desc 2"));
      repo.create(createTask("Tache 3", "Desc 3"));

      const tasks = repo.findAll();
      expect(tasks).toHaveLength(3);
    });
  });

  describe("findByStatus", () => {
    it("doit filtrer les taches par statut", () => {
      const task1 = createTask("Tache inbox", "Desc");
      const task2: Task = { ...createTask("Tache ready", "Desc"), status: "ready" };
      const task3 = createTask("Tache inbox 2", "Desc");

      repo.create(task1);
      repo.create(task2);
      repo.create(task3);

      const inboxTasks = repo.findByStatus("inbox");
      expect(inboxTasks).toHaveLength(2);

      const readyTasks = repo.findByStatus("ready");
      expect(readyTasks).toHaveLength(1);
      expect(readyTasks[0].title).toBe("Tache ready");
    });

    it("doit retourner une liste vide si aucune tache avec ce statut", () => {
      repo.create(createTask("Tache", "Desc"));

      const tasks = repo.findByStatus("running");
      expect(tasks).toEqual([]);
    });
  });

  describe("update", () => {
    it("doit mettre a jour une tache existante", () => {
      const task = createTask("Ancien titre", "Ancienne desc");
      repo.create(task);

      const updated: Task = {
        ...task,
        title: "Nouveau titre",
        description: "Nouvelle desc",
        status: "analyzing",
        updatedAt: new Date(),
      };
      repo.update(updated);

      const found = repo.findById(task.id);
      expect(found!.title).toBe("Nouveau titre");
      expect(found!.description).toBe("Nouvelle desc");
      expect(found!.status).toBe("analyzing");
    });

    it("doit conserver les dates correctement", () => {
      const task = createTask("Tache", "Desc");
      repo.create(task);

      const found = repo.findById(task.id);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.updatedAt).toBeInstanceOf(Date);
    });
  });
});
