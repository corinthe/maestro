import type { Task } from "./task.js";
import type { TaskStatus } from "./task-status.js";
import { isValidTransition } from "./task-status.js";
import { InvalidTaskTransitionError } from "./errors.js";

export function transitionTask(task: Task, newStatus: TaskStatus): Task {
  if (!isValidTransition(task.status, newStatus)) {
    throw new InvalidTaskTransitionError(task.id, task.status, newStatus);
  }

  return {
    ...task,
    status: newStatus,
    updatedAt: new Date(),
  };
}
