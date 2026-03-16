import type { ExecutionPlan } from "./task";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type ExecutionStatus = "running" | "completed" | "failed" | "cancelled";

export interface StepExecution {
  stepOrder: number;
  agent: string;
  task: string;
  status: StepStatus;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  attempt: number;
  feedback: string | null;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  plan: ExecutionPlan;
  steps: StepExecution[];
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string | null;
}
