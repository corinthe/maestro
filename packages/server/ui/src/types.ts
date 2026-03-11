export type TaskStatus = 'backlog' | 'plan' | 'in-progress' | 'done' | 'blocked';

export type PlanningPhase =
  | 'functional-planning'
  | 'functional-review'
  | 'technical-planning'
  | 'technical-review'
  | 'approved';

export interface PlanComment {
  id: string;
  taskId: string;
  phase: 'functional' | 'technical';
  content: string;
  createdAt: string;
}

export interface TaskPlanData {
  taskId: string;
  planningPhase: PlanningPhase | null;
  functionalPlanVersion: number;
  technicalPlanVersion: number;
  functionalPlan: string;
  technicalPlan: string;
  comments: PlanComment[];
}

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
  planningPhase?: PlanningPhase;
  functionalPlanVersion?: number;
  technicalPlanVersion?: number;
}

export interface AgentInfo {
  name: string;
  role: string;
  runner?: string;
  model?: string;
  enabled?: boolean;
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

export interface AgentOutputChunk {
  stream: 'stdout' | 'stderr';
  text: string;
  timestamp: string;
}

export interface AgentOutput {
  agent: string;
  taskId: string;
  chunks: AgentOutputChunk[];
}
