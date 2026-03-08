import type { LogEntry } from './types.js';

const MAX_IN_MEMORY_LOGS = 2000;
const logs: LogEntry[] = [];

export function appendLog(entry: LogEntry): void {
  logs.push(entry);
  if (logs.length > MAX_IN_MEMORY_LOGS) {
    logs.splice(0, logs.length - MAX_IN_MEMORY_LOGS);
  }
}

export function getLogs(): readonly LogEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs.length = 0;
}

export { MAX_IN_MEMORY_LOGS };
