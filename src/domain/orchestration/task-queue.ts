import type { Task } from "../task/index.js";

export interface TaskQueue {
  push(task: Task): void;
  pop(): Task | undefined;
  peek(): Task | undefined;
  get length(): number;
}
