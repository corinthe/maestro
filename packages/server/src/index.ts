import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Task, AgentState, HumanQueueItem } from '@maestro/core';
import {
  resolveAgentsPath,
  readYaml,
  writeYaml,
  readJson,
  readMarkdown,
  emitSignal,
} from '@maestro/core';

const PORT = 7842;

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
let paused = false;

interface AgentConfig {
  name: string;
  role: string;
  runner?: string;
  model?: string;
}

interface FileLock {
  file: string;
  agent: string;
  taskId: string;
}

interface LogEntry {
  timestamp: string;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

const MAX_IN_MEMORY_LOGS = 2000;
const inMemoryLogs: LogEntry[] = [];

function appendLog(entry: LogEntry) {
  inMemoryLogs.push(entry);
  if (inMemoryLogs.length > MAX_IN_MEMORY_LOGS) {
    inMemoryLogs.splice(0, inMemoryLogs.length - MAX_IN_MEMORY_LOGS);
  }
}

export function startServer(projectRoot: string) {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // ── Static UI ──────────────────────────────────────────────────────────────
  const distUiPath = path.join(__dirname, '..', 'dist-ui');
  app.use(express.static(distUiPath));

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', projectRoot });
  });

  // ── Status (pause/resume state) ────────────────────────────────────────────
  app.get('/api/status', (_req, res) => {
    res.json({ paused, projectRoot });
  });

  app.post('/api/pause', (_req, res) => {
    paused = true;
    appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'warn', message: 'Orchestrator paused by user' });
    broadcast(wss, { type: 'paused' });
    res.json({ paused });
  });

  app.post('/api/resume', (_req, res) => {
    paused = false;
    appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: 'Orchestrator resumed by user' });
    broadcast(wss, { type: 'resumed' });
    res.json({ paused });
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────
  app.get('/api/tasks', async (_req, res) => {
    try {
      const tasks: Task[] = [];

      const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
      const backlog = await readYaml<Task[]>(backlogPath).catch((): Task[] => []);
      tasks.push(...backlog);

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
          // directory may not exist
        }
      }

      res.json(tasks);
    } catch {
      res.status(500).json({ error: 'Failed to load tasks' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { title, description, acceptanceCriteria, dependsOn, filesLocked } = req.body as Record<string, unknown>;

      if (!title || !description) {
        res.status(400).json({ error: 'title and description are required' });
        return;
      }

      const task: Task = {
        id: `task-${Date.now()}`,
        title: String(title),
        description: String(description),
        status: 'backlog',
        acceptanceCriteria: acceptanceCriteria as string[] | undefined,
        dependsOn: dependsOn as string[] | undefined,
        filesLocked: filesLocked as string[] | undefined,
      };

      const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
      const backlog = await readYaml<Task[]>(backlogPath).catch((): Task[] => []);
      backlog.push(task);
      await writeYaml(backlogPath, backlog);

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Task created: ${task.title} (${task.id})` });
      broadcast(wss, { type: 'task-created', task });

      res.status(201).json(task);
    } catch {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // PATCH /api/tasks/:id/status — move a task to a different status column
  app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: Task['status'] };

      const validStatuses: Task['status'][] = ['backlog', 'in-progress', 'done', 'blocked'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      // Search for the task across all locations
      let task: Task | null = null;
      let taskFilePath: string | null = null;

      // Check backlog
      const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
      const backlog = await readYaml<Task[]>(backlogPath).catch((): Task[] => []);
      const backlogIdx = backlog.findIndex((t) => t.id === id);

      if (backlogIdx !== -1) {
        task = backlog[backlogIdx];
        if (status !== 'backlog') {
          backlog.splice(backlogIdx, 1);
          await writeYaml(backlogPath, backlog);
        }
      } else {
        // Check directories
        for (const s of ['in-progress', 'done', 'blocked'] as const) {
          const dir = resolveAgentsPath(projectRoot, 'tasks', s);
          try {
            const files = await fs.readdir(dir);
            for (const file of files) {
              if (!file.endsWith('.yaml')) continue;
              const fp = `${dir}/${file}`;
              const t = await readYaml<Task>(fp);
              if (t.id === id) {
                task = t;
                taskFilePath = fp;
                break;
              }
            }
          } catch { /* dir may not exist */ }
          if (task) break;
        }

        if (task && taskFilePath && task.status !== status) {
          await fs.rm(taskFilePath);
        }
      }

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      task.status = status;

      if (status === 'backlog') {
        if (backlogIdx === -1) {
          backlog.push(task);
          await writeYaml(backlogPath, backlog);
        }
      } else {
        const dir = resolveAgentsPath(projectRoot, 'tasks', status);
        await fs.mkdir(dir, { recursive: true });
        await writeYaml(`${dir}/${id}.yaml`, task);
      }

      broadcast(wss, { type: 'task-status-changed', taskId: id, status });
      res.json(task);
    } catch {
      res.status(500).json({ error: 'Failed to update task status' });
    }
  });

  // ── Agents ─────────────────────────────────────────────────────────────────
  app.get('/api/agents', async (_req, res) => {
    try {
      // Load agent configs
      const configPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
      const agentDefs = await readYaml<AgentConfig[]>(configPath).catch((): AgentConfig[] => []);

      const agentsDir = resolveAgentsPath(projectRoot, 'agents');
      const result: (AgentConfig & AgentState)[] = [];

      // Merge defined agents with their runtime state
      for (const def of agentDefs) {
        const statePath = `${agentsDir}/${def.name}/state.json`;
        const state = await readJson<AgentState>(statePath).catch((): AgentState => ({
          name: def.name,
          status: 'idle',
        }));
        result.push({ ...def, ...state });
      }

      // Include agents that have state files but aren't in config
      try {
        const entries = await fs.readdir(agentsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (agentDefs.some((a) => a.name === entry.name)) continue;
          const statePath = `${agentsDir}/${entry.name}/state.json`;
          const state = await readJson<AgentState>(statePath).catch((): AgentState => ({
            name: entry.name,
            status: 'idle',
          }));
          result.push({ role: 'unknown', ...state, name: entry.name });
        }
      } catch { /* agents/ may not exist */ }

      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed to load agents' });
    }
  });

  // ── File locks (derived from in-progress tasks) ────────────────────────────
  app.get('/api/locks', async (_req, res) => {
    try {
      const dir = resolveAgentsPath(projectRoot, 'tasks', 'in-progress');
      const locks: FileLock[] = [];

      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith('.yaml')) continue;
          const task = await readYaml<Task>(`${dir}/${file}`);
          if (task.filesLocked && task.agent) {
            for (const f of task.filesLocked) {
              locks.push({ file: f, agent: task.agent, taskId: task.id });
            }
          }
        }
      } catch { /* directory may not exist */ }

      res.json(locks);
    } catch {
      res.status(500).json({ error: 'Failed to load locks' });
    }
  });

  // ── Human queue ────────────────────────────────────────────────────────────
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
      } catch { /* directory may not exist */ }

      // Sort: pending first, then by createdAt desc
      items.sort((a, b) => {
        if (!a.resolvedAt && b.resolvedAt) return -1;
        if (a.resolvedAt && !b.resolvedAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(items);
    } catch {
      res.status(500).json({ error: 'Failed to load human queue' });
    }
  });

  app.post('/api/human-queue/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution } = req.body as { resolution?: string };

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

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Human queue resolved: ${id}` });
      broadcast(wss, { type: 'human-queue-resolved', id, resolution });

      res.json(item);
    } catch {
      res.status(500).json({ error: 'Failed to resolve human queue item' });
    }
  });

  // ── Orchestrator plan ──────────────────────────────────────────────────────
  app.get('/api/plan', async (_req, res) => {
    try {
      const planPath = resolveAgentsPath(projectRoot, 'orchestrator', 'plan.md');
      const content = await readMarkdown(planPath).catch(() => '');
      res.type('text/plain').send(content);
    } catch {
      res.status(500).json({ error: 'Failed to load plan' });
    }
  });

  // ── Logs ───────────────────────────────────────────────────────────────────
  app.get('/api/logs', async (_req, res) => {
    try {
      const logsDir = resolveAgentsPath(projectRoot, 'logs');
      const fileLogs: LogEntry[] = [];

      try {
        const files = await fs.readdir(logsDir);
        for (const file of files.filter((f) => f.endsWith('.log'))) {
          const content = await fs.readFile(`${logsDir}/${file}`, 'utf-8').catch(() => '');
          const agentName = file.replace(/\.log$/, '');
          for (const line of content.split('\n').filter(Boolean)) {
            try {
              const parsed = JSON.parse(line) as Partial<LogEntry>;
              fileLogs.push({
                timestamp: parsed.timestamp ?? new Date().toISOString(),
                agent: parsed.agent ?? agentName,
                level: parsed.level ?? 'info',
                message: parsed.message ?? line,
              });
            } catch {
              fileLogs.push({
                timestamp: new Date().toISOString(),
                agent: agentName,
                level: 'info',
                message: line,
              });
            }
          }
        }
      } catch { /* logs dir may not exist */ }

      // Merge file logs with in-memory logs and sort by timestamp
      const all = [...fileLogs, ...inMemoryLogs];
      all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      res.json(all.slice(-MAX_IN_MEMORY_LOGS));
    } catch {
      res.status(500).json({ error: 'Failed to load logs' });
    }
  });

  // ── New objective ──────────────────────────────────────────────────────────
  app.post('/api/objective', async (req, res) => {
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

  return { app, server, wss, isPaused: () => paused };
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
