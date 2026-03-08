export interface AgentConfig {
  name: string;
  role: string;
  runner?: string;
  model?: string;
  enabled?: boolean;
  systemPrompt?: string;
}

export interface FileLock {
  file: string;
  agent: string;
  taskId: string;
}

export interface LogEntry {
  timestamp: string;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}
