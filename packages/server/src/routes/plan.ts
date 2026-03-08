import { Router } from 'express';
import { resolveAgentsPath, readMarkdown } from '@maestro/core';

export function createPlanRoutes(projectRoot: string) {
  const router = Router();

  router.get('/api/plan', async (_req, res) => {
    try {
      const planPath = resolveAgentsPath(projectRoot, 'orchestrator', 'plan.md');
      const content = await readMarkdown(planPath).catch(() => '');
      res.type('text/plain').send(content);
    } catch {
      res.status(500).json({ error: 'Failed to load plan' });
    }
  });

  return router;
}
