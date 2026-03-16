import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../app.js";
import type { Application } from "express";
import type { AgentRegistry } from "../../domain/agent/agent-registry.js";
import type { AgentTemplate } from "../../domain/agent/agent-template.js";
import { AgentNotFoundError } from "../../domain/agent/errors.js";

class InMemoryAgentRegistry implements AgentRegistry {
  private agents: Map<string, AgentTemplate> = new Map();

  addAgent(template: AgentTemplate): void {
    this.agents.set(template.name, template);
  }

  async load(name: string): Promise<AgentTemplate> {
    const agent = this.agents.get(name);
    if (!agent) throw new AgentNotFoundError(name);
    return agent;
  }

  async list(): Promise<AgentTemplate[]> {
    return Array.from(this.agents.values());
  }

  async exists(name: string): Promise<boolean> {
    return this.agents.has(name);
  }
}

describe("API /api/agents", () => {
  let app: Application;
  let registry: InMemoryAgentRegistry;

  beforeEach(() => {
    const db = new Database(":memory:");
    registry = new InMemoryAgentRegistry();
    registry.addAgent({
      name: "backend",
      content: "# Agent Backend\n\nTu es un agent specialise en backend.",
      metadata: { description: "Agent Backend" },
    });
    registry.addAgent({
      name: "frontend",
      content: "# Agent Frontend\n\nTu es un agent specialise en frontend.",
      metadata: { description: "Agent Frontend" },
    });
    app = createApp({ db, agentRegistry: registry });
  });

  describe("GET /api/agents", () => {
    it("doit lister les agents avec nom et description", async () => {
      const res = await request(app).get("/api/agents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("name");
      expect(res.body[0]).toHaveProperty("description");
      expect(res.body[0]).not.toHaveProperty("content");
    });

    it("doit retourner les noms corrects", async () => {
      const res = await request(app).get("/api/agents");

      const names = res.body.map((a: any) => a.name).sort();
      expect(names).toEqual(["backend", "frontend"]);
    });
  });

  describe("GET /api/agents/:name", () => {
    it("doit retourner le template complet d'un agent", async () => {
      const res = await request(app).get("/api/agents/backend");

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("backend");
      expect(res.body.content).toContain("Agent Backend");
      expect(res.body.metadata.description).toBe("Agent Backend");
    });

    it("doit retourner 404 pour un agent inexistant", async () => {
      const res = await request(app).get("/api/agents/inexistant");

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("AGENT_NOT_FOUND");
      expect(res.body.suggestion).toBeDefined();
    });
  });
});
