import { Router } from "express";
import type { AgentRegistry } from "../../domain/agent/agent-registry.js";
import { AgentNotFoundError } from "../../domain/agent/errors.js";

export function createAgentRoutes(agentRegistry: AgentRegistry): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const agents = await agentRegistry.list();
      const summary = agents.map((a) => ({
        name: a.name,
        description: a.metadata.description,
      }));
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:name", async (req, res, next) => {
    try {
      const agent = await agentRegistry.load(req.params.name);
      res.json(agent);
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        next(err);
        return;
      }
      next(err);
    }
  });

  return router;
}
