import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = 7842;

export function startServer(projectRoot: string) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', projectRoot });
  });

  // TODO: REST API endpoints
  // GET  /api/tasks       — list all tasks
  // POST /api/tasks       — create a task
  // GET  /api/agents      — list agent states
  // GET  /api/human-queue — list items needing attention
  // POST /api/human-queue/:id/resolve — resolve a human queue item

  wss.on('connection', (ws) => {
    console.log('[server] Dashboard client connected');
    ws.send(JSON.stringify({ type: 'connected', projectRoot }));
  });

  server.listen(PORT, () => {
    console.log(`[server] Maestro dashboard available at http://localhost:${PORT}`);
  });

  return { app, server, wss };
}
