import { Router } from 'express';
import * as fs from 'node:fs/promises';
import type { WebSocketServer } from 'ws';
import type { Task } from '@maestro/core';
import { resolveAgentsPath, readYaml, writeYaml, emitSignal } from '@maestro/core';
import { appendLog } from '../logger.js';
import { broadcast } from '../broadcast.js';

export function loadBacklog(projectRoot: string): Promise<Task[]> {
  return loadBacklogFromPath(resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml'));
}

async function loadBacklogFromPath(backlogPath: string): Promise<Task[]> {
  const raw = await readYaml<Task[] | { tasks: Task[] }>(backlogPath).catch((): Task[] => []);
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'tasks' in raw && Array.isArray(raw.tasks)) return raw.tasks;
  return [];
}

export function createTaskRoutes(wss: WebSocketServer, projectRoot: string) {
  const router = Router();

  router.get('/api/tasks', async (_req, res) => {
    try {
      const tasks: Task[] = [];

      const backlog = await loadBacklog(projectRoot);
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

  router.post('/api/tasks', async (req, res) => {
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
      const backlog = await loadBacklog(projectRoot);
      backlog.push(task);
      await writeYaml(backlogPath, backlog);

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Task created: ${task.title} (${task.id})` });
      broadcast(wss, { type: 'task-created', task });

      // Emit a wake signal so the orchestrator picks up the new backlog task
      await emitSignal(projectRoot, {
        type: 'wake',
        summary: `New task created: ${task.id}`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(task);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('POST /api/tasks failed:', detail);
      res.status(500).json({ error: `Unable to save task to backlog: ${detail}` });
    }
  });

  router.patch('/api/tasks/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: Task['status'] };

      const validStatuses: Task['status'][] = ['backlog', 'in-progress', 'done', 'blocked'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      let task: Task | null = null;
      let taskFilePath: string | null = null;

      const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
      const backlog = await loadBacklog(projectRoot);
      const backlogIdx = backlog.findIndex((t) => t.id === id);

      if (backlogIdx !== -1) {
        task = backlog[backlogIdx];
        if (status !== 'backlog') {
          backlog.splice(backlogIdx, 1);
          await writeYaml(backlogPath, backlog);
        }
      } else {
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

  return router;
}
