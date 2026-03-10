import { Router } from 'express';
import type { WebSocketServer } from 'ws';
import { emitSignal } from '@maestro/core';
import { appendLog } from '../logger.js';
import { broadcast } from '../broadcast.js';

export function createStatusRoutes(wss: WebSocketServer, projectRoot: string) {
  const router = Router();
  let paused = false;

  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', projectRoot });
  });

  router.get('/api/status', (_req, res) => {
    res.json({ paused, projectRoot });
  });

  router.post('/api/pause', (_req, res) => {
    paused = true;
    appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'warn', message: 'Orchestrator paused by user' });
    broadcast(wss, { type: 'paused' });
    res.json({ paused });
  });

  router.post('/api/resume', (_req, res) => {
    paused = false;
    appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: 'Orchestrator resumed by user' });
    broadcast(wss, { type: 'resumed' });
    res.json({ paused });
  });

  router.post('/api/wake', async (_req, res) => {
    const ts = new Date().toISOString();
    appendLog({ timestamp: ts, agent: 'system', level: 'info', message: 'Orchestrator woken by user' });
    broadcast(wss, { type: 'wake' });
    try {
      await emitSignal(projectRoot, {
        type: 'wake',
        summary: 'Manual wake triggered from dashboard',
        timestamp: ts,
      });
      res.json({ status: 'woken', timestamp: ts });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to emit wake signal' });
    }
  });

  return { router, isPaused: () => paused };
}
