/**
 * Structured JSON logger with configurable levels.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("run started", { runId, agentId });
 *   logger.error("spawn failed", { pid, error: err.message });
 *
 * Environment:
 *   LOG_LEVEL=debug|info|warn|error (default: info)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: Level = (
  ["debug", "info", "warn", "error"].includes(process.env.LOG_LEVEL ?? "")
    ? process.env.LOG_LEVEL!
    : "info"
) as Level;

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function write(level: Level, module: string, message: string, data?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    module,
    msg: message,
  };
  if (data) Object.assign(entry, data);

  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export type Logger = {
  debug: (msg: string, data?: Record<string, unknown>) => void;
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
};

/**
 * Create a scoped logger for a specific module.
 */
export function createLogger(module: string): Logger {
  return {
    debug: (msg, data) => write("debug", module, msg, data),
    info: (msg, data) => write("info", module, msg, data),
    warn: (msg, data) => write("warn", module, msg, data),
    error: (msg, data) => write("error", module, msg, data),
  };
}

/** Default logger (module: "app") */
export const logger = createLogger("app");
