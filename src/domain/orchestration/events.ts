export type TaskEventType =
  | "task:status_changed"
  | "task:plan_ready"
  | "task:agent_started"
  | "task:agent_output"
  | "task:agent_completed"
  | "task:pr_opened"
  | "task:failed";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type TaskEventListener = (event: TaskEvent) => void;

export interface EventBus {
  emit(event: TaskEvent): void;
  on(type: TaskEventType, listener: TaskEventListener): void;
  off(type: TaskEventType, listener: TaskEventListener): void;
  onAll(listener: TaskEventListener): void;
  offAll(listener: TaskEventListener): void;
}
