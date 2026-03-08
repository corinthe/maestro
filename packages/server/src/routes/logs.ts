import { Router } from 'express';
import * as fs from 'node:fs/promises';
import { resolveAgentsPath } from '@maestro/core';
import type { LogEntry } from '../types.js';
import { getLogs, MAX_IN_MEMORY_LOGS } from '../logger.js';

export function createLogRoutes(projectRoot: string) {
  const router = Router();

  router.get('/api/logs', async (_req, res) => {
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

      const all = [...fileLogs, ...getLogs()];
      all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      res.json(all.slice(-MAX_IN_MEMORY_LOGS));
    } catch {
      res.status(500).json({ error: 'Failed to load logs' });
    }
  });

  return router;
}
