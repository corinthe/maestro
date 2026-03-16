import type { Task } from "../../domain/task/index.js";
import type { TaskQueue } from "../../domain/orchestration/task-queue.js";

export class InMemoryTaskQueue implements TaskQueue {
  private readonly queue: Task[] = [];

  push(task: Task): void {
    this.queue.push(task);
  }

  pop(): Task | undefined {
    return this.queue.shift();
  }

  peek(): Task | undefined {
    return this.queue[0];
  }

  get length(): number {
    return this.queue.length;
  }
}
