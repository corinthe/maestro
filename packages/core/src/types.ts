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

export interface Agent {
  name: string;
  role: string;
  systemPrompt: string;
  runner: string;
  model?: string;
}

export interface AgentState {
  name: string;
  status: 'idle' | 'working' | 'waiting';
  currentTaskId?: string;
  lastActiveAt?: string;
}

export type SignalType =
  | 'new-objective'
  | 'task-completed'
  | 'task-blocked'
  | 'agent-error'
  | 'wake';

export interface Signal {
  type: SignalType;
  taskId?: string;
  agent?: string;
  summary?: string;
  timestamp: string;
}

export interface Lock {
  taskId: string;
  agent: string;
  files: string[];
  acquiredAt: string;
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

export interface AgentRunResult {
  success: boolean;
  summary: string;
  filesModified?: string[];
  error?: string;
}

export interface AgentRunner {
  run(agent: Agent, contextPath: string): Promise<AgentRunResult>;
  isAvailable(): Promise<boolean>;
}
