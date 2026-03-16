import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import Database from "better-sqlite3";
import { createProjectRoutes } from "./project-routes.js";
import { FileSystemProjectLoader } from "../../infra/filesystem/filesystem-project-loader.js";
import { FileSystemAgentRegistry } from "../../infra/filesystem/filesystem-agent-registry.js";
import { SqliteTaskRepository } from "../../infra/sqlite/sqlite-task-repository.js";
import { runMigrations } from "../../infra/sqlite/database.js";
import { errorHandler } from "../middleware/error-handler.js";

describe("API /api/project", () => {
  let app: express.Application;
  let tempDir: string;
  let db: Database.Database;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "maestro-project-test-"));

    // Creer un dossier agents avec au moins un fichier
    await mkdir(join(tempDir, "agents"), { recursive: true });
    await writeFile(join(tempDir, "agents", "backend.md"), "# Agent Backend\nAgent pour le code backend.");
    await writeFile(join(tempDir, "agents", "frontend.md"), "# Agent Frontend\nAgent pour le code frontend.");

    db = new Database(":memory:");
    runMigrations(db);

    const projectLoader = new FileSystemProjectLoader();
    const agentRegistry = new FileSystemAgentRegistry(join(tempDir, "agents"));
    const taskRepository = new SqliteTaskRepository(db);

    app = express();
    app.use(express.json());
    app.use("/api/project", createProjectRoutes({
      projectLoader,
      agentRegistry,
      taskRepository,
      workingDir: tempDir,
    }));
    app.use(errorHandler);
  });

  afterEach(async () => {
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("GET /api/project", () => {
    it("doit retourner la configuration par defaut", async () => {
      const res = await request(app).get("/api/project");

      expect(res.status).toBe(200);
      expect(res.body.config.workingDir).toBe(tempDir);
      expect(res.body.config.defaultBranch).toBe("main");
      expect(res.body.hasSoul).toBe(false);
      expect(res.body.soulSize).toBe(0);
    });

    it("doit detecter la presence du SOUL.md", async () => {
      await writeFile(join(tempDir, "SOUL.md"), "# Mon projet\nConventions ici.");

      // Nouveau loader pour eviter le cache
      const projectLoader = new FileSystemProjectLoader();
      const agentRegistry = new FileSystemAgentRegistry(join(tempDir, "agents"));
      const taskRepository = new SqliteTaskRepository(db);
      const freshApp = express();
      freshApp.use(express.json());
      freshApp.use("/api/project", createProjectRoutes({
        projectLoader, agentRegistry, taskRepository, workingDir: tempDir,
      }));

      const res = await request(freshApp).get("/api/project");

      expect(res.status).toBe(200);
      expect(res.body.hasSoul).toBe(true);
      expect(res.body.soulSize).toBeGreaterThan(0);
    });
  });

  describe("GET /api/project/soul", () => {
    it("doit retourner une chaine vide si pas de SOUL.md", async () => {
      const res = await request(app).get("/api/project/soul");

      expect(res.status).toBe(200);
      expect(res.text).toBe("");
    });

    it("doit retourner le contenu du SOUL.md", async () => {
      const content = "# Mon Projet\n\nRegles du projet.";
      await writeFile(join(tempDir, "SOUL.md"), content);

      // Nouveau loader
      const projectLoader = new FileSystemProjectLoader();
      const freshApp = express();
      freshApp.use(express.json());
      freshApp.use("/api/project", createProjectRoutes({
        projectLoader,
        agentRegistry: new FileSystemAgentRegistry(join(tempDir, "agents")),
        taskRepository: new SqliteTaskRepository(db),
        workingDir: tempDir,
      }));

      const res = await request(freshApp).get("/api/project/soul");

      expect(res.status).toBe(200);
      expect(res.text).toBe(content);
    });
  });

  describe("PUT /api/project/config", () => {
    it("doit sauvegarder la configuration", async () => {
      const res = await request(app)
        .put("/api/project/config")
        .send({ defaultBranch: "develop", maxRetries: 3 });

      expect(res.status).toBe(200);
      expect(res.body.config.defaultBranch).toBe("develop");
      expect(res.body.config.maxRetries).toBe(3);
    });

    it("doit refuser une configuration invalide", async () => {
      const res = await request(app)
        .put("/api/project/config")
        .send({ maxRetries: 100 });

      expect(res.status).toBe(400);
    });

    it("doit refuser la modification si des taches sont en cours", async () => {
      // Inserer une tache en running
      const taskRepository = new SqliteTaskRepository(db);
      const task = { id: "test-id", title: "Test", description: "desc", status: "running" as const, plan: null, branch: null, prUrl: null, agentLogs: null, createdAt: new Date(), updatedAt: new Date() };
      taskRepository.create(task);

      const res = await request(app)
        .put("/api/project/config")
        .send({ defaultBranch: "develop" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PROJECT_CONFIG_LOCKED");
    });
  });

  describe("GET /api/project/agents", () => {
    it("doit retourner tous les agents par defaut", async () => {
      const res = await request(app).get("/api/project/agents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((a: { name: string }) => a.name).sort()).toEqual(["backend", "frontend"]);
    });
  });
});
