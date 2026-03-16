import { v4 as uuidv4 } from "uuid";
import type { StepStatus } from "./step-status.js";
import type { ExecutionPlan } from "./execution-plan.js";

export interface StepExecution {
  readonly stepOrder: number;
  readonly agent: string;
  readonly task: string;
  readonly status: StepStatus;
  readonly output: string | null;
  readonly error: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly attempt: number;
  readonly feedback: string | null;
}

export type ExecutionStatus = "running" | "completed" | "failed" | "cancelled";

export interface TaskExecution {
  readonly id: string;
  readonly taskId: string;
  readonly plan: ExecutionPlan;
  readonly steps: StepExecution[];
  readonly status: ExecutionStatus;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export function createExecution(taskId: string, plan: ExecutionPlan): TaskExecution {
  const steps: StepExecution[] = plan.steps.map((step) => ({
    stepOrder: step.order,
    agent: step.agent,
    task: step.task,
    status: "pending",
    output: null,
    error: null,
    startedAt: null,
    completedAt: null,
    attempt: 1,
    feedback: null,
  }));

  return {
    id: uuidv4(),
    taskId,
    plan,
    steps,
    status: "running",
    startedAt: new Date(),
    completedAt: null,
  };
}

export function updateStepStatus(
  execution: TaskExecution,
  stepOrder: number,
  status: StepStatus,
  output?: string,
  error?: string,
): TaskExecution {
  const now = new Date();
  const steps = execution.steps.map((step) => {
    if (step.stepOrder !== stepOrder) return step;

    return {
      ...step,
      status,
      output: output ?? step.output,
      error: error ?? step.error,
      startedAt: status === "running" ? now : step.startedAt,
      completedAt: status === "completed" || status === "failed" || status === "skipped" ? now : step.completedAt,
    };
  });

  return { ...execution, steps };
}

export function getFailedSteps(execution: TaskExecution): StepExecution[] {
  return execution.steps.filter((step) => step.status === "failed");
}

export function getRetryableExecution(
  execution: TaskExecution,
  stepsToRetry: number[],
  feedback?: string,
): TaskExecution {
  const steps: StepExecution[] = execution.steps.map((step) => {
    if (stepsToRetry.includes(step.stepOrder)) {
      return {
        ...step,
        status: "pending" as StepStatus,
        output: null,
        error: null,
        startedAt: null,
        completedAt: null,
        attempt: step.attempt + 1,
        feedback: feedback ?? step.feedback,
      };
    }
    // Keep completed steps as-is, mark others as skipped
    if (step.status === "completed") {
      return step;
    }
    return { ...step, status: "skipped" as StepStatus };
  });

  return {
    id: uuidv4(),
    taskId: execution.taskId,
    plan: execution.plan,
    steps,
    status: "running",
    startedAt: new Date(),
    completedAt: null,
  };
}

export function isExecutionComplete(execution: TaskExecution): boolean {
  return execution.steps.every(
    (step) => step.status === "completed" || step.status === "skipped",
  );
}
