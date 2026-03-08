import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import * as path from 'node:path';
import { appendLog } from './logger.js';
import { createStatusRoutes } from './routes/status.js';
import { createTaskRoutes } from './routes/tasks.js';
import { createAgentRoutes } from './routes/agents.js';
import { createLockRoutes } from './routes/locks.js';
import { createHumanQueueRoutes } from './routes/human-queue.js';
import { createLogRoutes } from './routes/logs.js';
import { createObjectiveRoutes } from './routes/objective.js';
import { createPlanRoutes } from './routes/plan.js';

const PORT = 7842;

export function startServer(projectRoot: string) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // ── Static UI ──────────────────────────────────────────────────────────────
  const distUiPath = path.join(__dirname, '..', 'dist-ui');
  app.use(express.static(distUiPath));

  // ── API routes ─────────────────────────────────────────────────────────────
  const { router: statusRouter, isPaused } = createStatusRoutes(wss, projectRoot);
  app.use(statusRouter);
  app.use(createTaskRoutes(wss, projectRoot));
  app.use(createAgentRoutes(wss, projectRoot));
  app.use(createLockRoutes(projectRoot));
  app.use(createHumanQueueRoutes(wss, projectRoot));
  app.use(createLogRoutes(projectRoot));
  app.use(createObjectiveRoutes(wss, projectRoot));
  app.use(createPlanRoutes(projectRoot));

  // ── WebSocket ──────────────────────────────────────────────────────────────
  wss.on('connection', (ws) => {
    console.log('[server] Dashboard client connected');
    appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'debug', message: 'Dashboard client connected' });
    ws.send(JSON.stringify({ type: 'connected', projectRoot }));
  });

  // ── SPA fallback (must be after all API routes) ────────────────────────────
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distUiPath, 'index.html'));
  });

  server.listen(PORT, () => {
    console.log(`[server] Maestro dashboard available at http://localhost:${PORT}`);
  });

  return { app, server, wss, isPaused };
}
