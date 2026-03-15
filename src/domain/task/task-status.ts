export const TASK_STATUSES = [
  "inbox",
  "analyzing",
  "ready",
  "approved",
  "running",
  "review",
  "done",
  "failed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const VALID_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  inbox: ["analyzing"],
  analyzing: ["ready", "failed"],
  ready: ["approved", "inbox"],
  approved: ["running"],
  running: ["review", "failed"],
  review: ["done", "failed", "running"],
  done: [],
  failed: ["inbox"],
};

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getValidTransitions(from: TaskStatus): readonly TaskStatus[] {
  return VALID_TRANSITIONS[from];
}
