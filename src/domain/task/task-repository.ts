import type { Task } from "./task.js";
import type { TaskStatus } from "./task-status.js";

export interface TaskRepository {
  create(task: Task): Task;
  findById(id: string): Task | null;
  findAll(): Task[];
  findByStatus(status: TaskStatus): Task[];
  update(task: Task): Task;
}
