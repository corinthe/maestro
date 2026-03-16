export type TaskEventType =
  | "task:status_changed"
  | "task:plan_ready"
  | "task:plan_updated"
  | "task:agent_started"
  | "task:agent_output"
  | "task:agent_completed"
  | "task:pr_opened"
  | "task:failed"
  | "task:step_retried"
  | "task:execution_started";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
