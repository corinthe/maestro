import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { resolveAgentsPath, fileExists } from '@maestro/core';

export interface LogsOptions {
  follow?: boolean;
  lines?: string;
}

export async function logsCommand(agent: string, opts: LogsOptions): Promise<void> {
  const projectRoot = process.cwd();
  const agentsRoot = resolveAgentsPath(projectRoot);

  if (!(await fileExists(agentsRoot))) {
    console.error('No .ai-agents/ directory found. Run `maestro init` first.');
    process.exit(1);
  }

  const logsDir = resolveAgentsPath(projectRoot, 'logs');
  const logFile = path.join(logsDir, `${agent}.log`);

  // Also check for rotated files with the same prefix
  if (!(await fileExists(logFile))) {
    // Check if there are any log files for this agent (rotated ones)
    try {
      const files = await fsp.readdir(logsDir);
      const agentFiles = files.filter((f) => f.startsWith(`${agent}.`));
      if (agentFiles.length === 0) {
        console.error(`No log file found for agent "${agent}".`);
        // List available log files
        const allLogs = files.filter((f) => f.endsWith('.log'));
        if (allLogs.length > 0) {
          console.error('Available agents:');
          for (const f of allLogs) {
            console.error(`  - ${f.replace(/\.log$/, '')}`);
          }
        }
        process.exit(1);
      }
    } catch {
      console.error(`Logs directory not found. Is maestro running?`);
      process.exit(1);
    }
  }

  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';
  const CYAN = '\x1b[36m';
  const YELLOW = '\x1b[33m';
  const RED = '\x1b[31m';

  const levelColor: Record<string, string> = {
    debug: DIM,
    info: CYAN,
    warn: YELLOW,
    error: RED,
  };

  const formatLine = (raw: string): string => {
    try {
      const entry = JSON.parse(raw) as {
        time?: string;
        timestamp?: string;
        level?: number | string;
        msg?: string;
        message?: string;
        agent?: string;
      };
      // pino uses numeric levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error
      let levelStr: string;
      if (typeof entry.level === 'number') {
        const map: Record<number, string> = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };
        levelStr = map[entry.level] ?? String(entry.level);
      } else {
        levelStr = String(entry.level ?? 'info');
      }
      const color = levelColor[levelStr] ?? RESET;
      const ts = entry.time ?? entry.timestamp ?? '';
      const shortTs = ts.replace(/T/, ' ').replace(/\.\d+Z$/, '');
      const msg = entry.msg ?? entry.message ?? raw;
      return `${DIM}${shortTs}${RESET} ${color}${levelStr.padEnd(5)}${RESET} ${msg}`;
    } catch {
      return raw;
    }
  };

  const tailLines = parseInt(opts.lines ?? '50', 10);

  // Print existing lines (tail)
  if (await fileExists(logFile)) {
    const content = await fsp.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const tail = lines.slice(-tailLines);
    for (const line of tail) {
      console.log(formatLine(line));
    }
  }

  // Follow mode — watch for new lines
  if (opts.follow !== false) {
    console.log(`${DIM}--- streaming ${agent} logs (Ctrl+C to stop) ---${RESET}`);

    await new Promise<void>((resolve) => {
      let currentSize = 0;
      try {
        const stat = fs.statSync(logFile);
        currentSize = stat.size;
      } catch { /* file might not exist yet */ }

      const watcher = fs.watch(logsDir, (eventType, filename) => {
        if (!filename?.startsWith(agent)) return;
        const target = path.join(logsDir, `${agent}.log`);
        try {
          const stat = fs.statSync(target);
          if (stat.size <= currentSize) {
            currentSize = stat.size;
            return;
          }
          const stream = fs.createReadStream(target, {
            start: currentSize,
            encoding: 'utf-8',
          });
          const rl = readline.createInterface({ input: stream });
          rl.on('line', (line) => {
            if (line.trim()) console.log(formatLine(line));
          });
          rl.on('close', () => {
            currentSize = stat.size;
          });
        } catch { /* file may have been rotated */ }
      });

      process.on('SIGINT', () => {
        watcher.close();
        resolve();
      });
      process.on('SIGTERM', () => {
        watcher.close();
        resolve();
      });
    });
  }
}
