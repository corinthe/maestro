import { Router } from 'express';
import type { WebSocketServer } from 'ws';
import { emitSignal } from '@maestro/core';
import { appendLog } from '../logger.js';
import { broadcast } from '../broadcast.js';

export function createObjectiveRoutes(wss: WebSocketServer, projectRoot: string) {
  const router = Router();

  router.post('/api/objective', async (req, res) => {
    try {
      const { objective } = req.body as { objective?: string };

      if (!objective) {
        res.status(400).json({ error: 'objective is required' });
        return;
      }

      const signalPath = await emitSignal(projectRoot, {
        type: 'new-objective',
        summary: objective,
        timestamp: new Date().toISOString(),
      });

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `New objective submitted: ${objective}` });
      broadcast(wss, { type: 'new-objective', objective });

      res.status(201).json({ status: 'accepted', objective, signalPath });
    } catch {
      res.status(500).json({ error: 'Failed to submit objective' });
    }
  });

  return router;
}
