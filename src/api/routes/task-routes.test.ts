import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import type { Express } from "express";

describe("API /api/tasks", () => {
  let app: Express;

  beforeEach(() => {
    const db = new Database(":memory:");
    app = createApp({ db });
  });

  describe("POST /api/tasks", () => {
    it("doit creer une tache avec un titre et une description", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ title: "Ma tache", description: "Description complete" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Ma tache");
      expect(res.body.description).toBe("Description complete");
      expect(res.body.status).toBe("inbox");
      expect(res.body.id).toBeDefined();
    });

    it("doit refuser une tache sans titre", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ description: "Desc" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("doit refuser une tache sans description", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({ title: "Titre" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("doit refuser un body vide", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/tasks", () => {
    it("doit retourner une liste vide au debut", async () => {
      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("doit retourner les taches creees", async () => {
      await request(app).post("/api/tasks").send({ title: "T1", description: "D1" });
      await request(app).post("/api/tasks").send({ title: "T2", description: "D2" });

      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("doit filtrer par statut", async () => {
      await request(app).post("/api/tasks").send({ title: "T1", description: "D1" });
      await request(app).post("/api/tasks").send({ title: "T2", description: "D2" });

      const res = await request(app).get("/api/tasks?status=inbox");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const resRunning = await request(app).get("/api/tasks?status=running");

      expect(resRunning.status).toBe(200);
      expect(resRunning.body).toEqual([]);
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("doit retourner une tache par son id", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .send({ title: "Ma tache", description: "Desc" });
      const taskId = createRes.body.id;

      const res = await request(app).get(`/api/tasks/${taskId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(taskId);
      expect(res.body.title).toBe("Ma tache");
    });

    it("doit retourner 404 si la tache n'existe pas", async () => {
      const res = await request(app).get("/api/tasks/inexistant");

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("TASK_NOT_FOUND");
    });
  });

  describe("PUT /api/tasks/:id", () => {
    it("doit modifier le titre d'une tache", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .send({ title: "Ancien", description: "Desc" });
      const taskId = createRes.body.id;

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ title: "Nouveau" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Nouveau");
      expect(res.body.description).toBe("Desc");
    });

    it("doit effectuer une transition de statut valide", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .send({ title: "Tache", description: "Desc" });
      const taskId = createRes.body.id;

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ status: "analyzing" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("analyzing");
    });

    it("doit refuser une transition de statut invalide", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .send({ title: "Tache", description: "Desc" });
      const taskId = createRes.body.id;

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ status: "done" });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("TASK_INVALID_TRANSITION");
      expect(res.body.suggestion).toBeDefined();
    });

    it("doit retourner 404 si la tache n'existe pas", async () => {
      const res = await request(app)
        .put("/api/tasks/inexistant")
        .send({ title: "Nouveau" });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("TASK_NOT_FOUND");
    });

    it("doit modifier titre et description en meme temps", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .send({ title: "T", description: "D" });
      const taskId = createRes.body.id;

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ title: "Nouveau titre", description: "Nouvelle desc" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Nouveau titre");
      expect(res.body.description).toBe("Nouvelle desc");
    });
  });

  describe("GET /api/health", () => {
    it("doit retourner ok", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
