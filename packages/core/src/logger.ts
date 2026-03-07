import pino from 'pino';
import * as path from 'node:path';
import { resolveAgentsPath } from './file-store.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface CreateLoggerOptions {
  /** Project root directory (used to resolve .ai-agents/logs/) */
  projectRoot: string;
  /** Component name used as the logger name (e.g. "orchestrator", "server") */
  component: string;
  /** Minimum log level (default: "info") */
  level?: LogLevel;
}

/**
 * Create a structured pino logger that writes to both stdout and a rotating
 * log file under `.ai-agents/logs/<component>.log`.
 *
 * Log rotation is handled by `pino-roll`:
 * - rotates daily (frequency: "daily")
 * - keeps last 7 files
 */
export function createLogger(opts: CreateLoggerOptions): pino.Logger {
  const { projectRoot, component, level = 'info' } = opts;
  const logsDir = resolveAgentsPath(projectRoot, 'logs');
  const logFile = path.join(logsDir, `${component}.log`);

  const targets: pino.TransportTargetOptions[] = [
    // Pretty-print to stdout
    {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
      level,
    },
    // Rotating file transport
    {
      target: 'pino-roll',
      options: {
        file: logFile,
        frequency: 'daily',
        limit: { count: 7 },
        mkdir: true,
      },
      level,
    },
  ];

  return pino({
    name: component,
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: { targets },
  });
}

/**
 * Lightweight logger for one-off CLI commands that only logs to stdout.
 * No file transport is needed for quick commands like `maestro status`.
 */
export function createCliLogger(component: string, level: LogLevel = 'info'): pino.Logger {
  return pino({
    name: component,
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      target: 'pino/file',
      options: { destination: 1 },
    },
  });
}
