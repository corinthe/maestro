export type TaskStatus = 'backlog' | 'in-progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  agent?: string;
  acceptanceCriteria?: string[];
  sourceRef?: string;
  filesLocked?: string[];
  dependsOn?: string[];
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
}

export interface AgentInfo {
  name: string;
  role: string;
  runner?: string;
  model?: string;
  status: 'idle' | 'working' | 'waiting';
  currentTaskId?: string;
  lastActiveAt?: string;
}

export interface FileLock {
  file: string;
  agent: string;
  taskId: string;
}

export interface HumanQueueItem {
  id: string;
  type: 'conflict' | 'decision' | 'error';
  title: string;
  description: string;
  context?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface LogEntry {
  timestamp: string;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export interface AppStatus {
  paused: boolean;
  projectRoot: string;
}
