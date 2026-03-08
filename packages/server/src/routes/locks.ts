import { Router } from 'express';
import * as fs from 'node:fs/promises';
import type { Task } from '@maestro/core';
import { resolveAgentsPath, readYaml } from '@maestro/core';
import type { FileLock } from '../types.js';

export function createLockRoutes(projectRoot: string) {
  const router = Router();

  router.get('/api/locks', async (_req, res) => {
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

  return router;
}
