import { Router } from 'express';
import * as fs from 'node:fs/promises';
import type { WebSocketServer } from 'ws';
import type { HumanQueueItem } from '@maestro/core';
import { resolveAgentsPath, readYaml, writeYaml } from '@maestro/core';
import { appendLog } from '../logger.js';
import { broadcast } from '../broadcast.js';

export function createHumanQueueRoutes(wss: WebSocketServer, projectRoot: string) {
  const router = Router();

  router.get('/api/human-queue', async (_req, res) => {
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

  router.post('/api/human-queue/:id/resolve', async (req, res) => {
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

  return router;
}
