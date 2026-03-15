import { v4 as uuidv4 } from "uuid";
import type { TaskStatus } from "./task-status.js";

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly plan: string | null;
  readonly branch: string | null;
  readonly prUrl: string | null;
  readonly agentLogs: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createTask(title: string, description: string): Task {
  const now = new Date();
  return {
    id: uuidv4(),
    title,
    description,
    status: "inbox",
    plan: null,
    branch: null,
    prUrl: null,
    agentLogs: null,
    createdAt: now,
    updatedAt: now,
  };
}
