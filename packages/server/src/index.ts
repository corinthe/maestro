import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import * as fs from 'node:fs/promises';
import type { Task, AgentState, HumanQueueItem } from '@maestro/core';
import {
  resolveAgentsPath,
  readYaml,
  writeYaml,
  readJson,
  emitSignal,
} from '@maestro/core';

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

  // -------------------------------------------------------------------------
  // GET /api/tasks — list all tasks (backlog + in-progress + done + blocked)
  // -------------------------------------------------------------------------
  app.get('/api/tasks', async (_req, res) => {
    try {
      const tasks: Task[] = [];

      // Load backlog
      const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
      const backlog = await readYaml<Task[]>(backlogPath).catch(() => []);
      tasks.push(...backlog);

      // Load tasks from status directories
      for (const status of ['in-progress', 'done', 'blocked'] as const) {
        const dir = resolveAgentsPath(projectRoot, 'tasks', status);
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            if (file.endsWith('.yaml')) {
              const task = await readYaml<Task>(`${dir}/${file}`);
              tasks.push(task);
            }
          }
        } catch {
          // Directory may not exist yet
        }
      }

      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load tasks' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/tasks — create a task manually
  // -------------------------------------------------------------------------
  app.post('/api/tasks', async (req, res) => {
    try {
      const { title, description, acceptanceCriteria, dependsOn, filesLocked } = req.body;

      if (!title || !description) {
        res.status(400).json({ error: 'title and description are required' });
        return;
      }

      const task: Task = {
        id: `task-${Date.now()}`,
        title,
        description,
        status: 'backlog',
        acceptanceCriteria,
        dependsOn,
        filesLocked,
      };

      // Append to backlog
      const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
      const backlog = await readYaml<Task[]>(backlogPath).catch((): Task[] => []);
      backlog.push(task);
      await writeYaml(backlogPath, backlog);

      broadcast(wss, { type: 'task-created', task });

      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/agents — list agent states
  // -------------------------------------------------------------------------
  app.get('/api/agents', async (_req, res) => {
    try {
      const agentsDir = resolveAgentsPath(projectRoot, 'agents');
      const states: AgentState[] = [];

      try {
        const entries = await fs.readdir(agentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const statePath = `${agentsDir}/${entry.name}/state.json`;
            try {
              const state = await readJson<AgentState>(statePath);
              states.push(state);
            } catch {
              // Agent exists but has no state file yet — report as idle
              states.push({
                name: entry.name,
                status: 'idle',
              });
            }
          }
        }
      } catch {
        // agents/ directory may not exist
      }

      res.json(states);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load agent states' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /api/human-queue — list items awaiting human attention
  // -------------------------------------------------------------------------
  app.get('/api/human-queue', async (_req, res) => {
    try {
      const dir = resolveAgentsPath(projectRoot, 'human-queue');
      const items: HumanQueueItem[] = [];

      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.yaml')) {
            const item = await readYaml<HumanQueueItem>(`${dir}/${file}`);
            items.push(item);
          }
        }
      } catch {
        // Directory may not exist
      }

      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load human queue' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/human-queue/:id/resolve — resolve a human-queue item
  // -------------------------------------------------------------------------
  app.post('/api/human-queue/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution } = req.body;

      if (!resolution) {
        res.status(400).json({ error: 'resolution is required' });
        return;
      }

      const itemPath = resolveAgentsPath(projectRoot, 'human-queue', `${id}.yaml`);

      let item: HumanQueueItem;
      try {
        item = await readYaml<HumanQueueItem>(itemPath);
      } catch {
        res.status(404).json({ error: `Human queue item "${id}" not found` });
        return;
      }

      item.resolvedAt = new Date().toISOString();
      item.resolution = resolution;
      await writeYaml(itemPath, item);

      broadcast(wss, { type: 'human-queue-resolved', id, resolution });

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to resolve human queue item' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/objective — submit a new objective (emits new-objective signal)
  // -------------------------------------------------------------------------
  app.post('/api/objective', async (req, res) => {
    try {
      const { objective } = req.body;

      if (!objective) {
        res.status(400).json({ error: 'objective is required' });
        return;
      }

      const signalPath = await emitSignal(projectRoot, {
        type: 'new-objective',
        summary: objective,
        timestamp: new Date().toISOString(),
      });

      broadcast(wss, { type: 'new-objective', objective });

      res.status(201).json({ status: 'accepted', objective, signalPath });
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit objective' });
    }
  });

  // -------------------------------------------------------------------------
  // WebSocket — real-time updates
  // -------------------------------------------------------------------------
  wss.on('connection', (ws) => {
    console.log('[server] Dashboard client connected');
    ws.send(JSON.stringify({ type: 'connected', projectRoot }));
  });

  server.listen(PORT, () => {
    console.log(`[server] Maestro dashboard available at http://localhost:${PORT}`);
  });

  return { app, server, wss };
}

// ---------------------------------------------------------------------------
// WebSocket broadcast helper
// ---------------------------------------------------------------------------
function broadcast(wss: WebSocketServer, data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
