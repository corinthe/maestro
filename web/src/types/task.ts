export const TASK_STATUSES = [
  "inbox",
  "analyzing",
  "ready",
  "approved",
  "running",
  "review",
  "done",
  "failed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  plan: string | null;
  branch: string | null;
  prUrl: string | null;
  agentLogs: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanStep {
  order: number;
  agent: string;
  task: string;
  dependsOn: number[];
  parallel: boolean;
}

export interface ExecutionPlan {
  summary: string;
  steps: PlanStep[];
  filesImpacted: string[];
  questions: string[];
}

export interface AgentSummary {
  name: string;
  description: string;
}

export interface AgentTemplate {
  name: string;
  content: string;
  metadata: {
    description: string;
  };
}

export interface TaskLogs {
  taskId: string;
  status: TaskStatus;
  logs: Record<string, unknown>;
}

export interface ProjectInfo {
  config: {
    workingDir: string;
    gitRemote?: string;
    defaultBranch: string;
    agents?: string[];
    orchestratorAgent: string;
    maxRetries: number;
    timeout: number;
  };
  hasSoul: boolean;
  soulSize: number;
  sharedContextSize: number;
}

export interface ProjectAgentInfo {
  name: string;
  description: string;
}
