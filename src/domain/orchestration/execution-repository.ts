import type { TaskExecution } from "./task-execution.js";

export interface ExecutionRepository {
  create(execution: TaskExecution): TaskExecution;
  findById(id: string): TaskExecution | null;
  findByTaskId(taskId: string): TaskExecution[];
  findLatestByTaskId(taskId: string): TaskExecution | null;
  update(execution: TaskExecution): TaskExecution;
}
