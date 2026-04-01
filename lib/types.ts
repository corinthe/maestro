// Internal agent name for the orchestrator (used to filter from UI listings)
export const ORCHESTRATOR_AGENT_NAME = "__orchestrator__";

// Shared types matching Drizzle schema output (camelCase)

export type Feature = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  agentId: string | null;
  branch: string | null;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Agent = {
  id: string;
  name: string;
  description: string | null;
  config: string; // JSON string
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type Run = {
  id: string;
  agentId: string | null;
  featureId: string | null;
  runType: string;
  status: string;
  sessionId: string | null;
  prompt: string | null;
  summary: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  costUsd: number | null;
  exitCode: number | null;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type Message = {
  id: string;
  content: string;
  targetAgent: string | null;
  featureId: string | null;
  status: string;
  createdAt: string;
  readAt: string | null;
};

// Status constants

export const FEATURE_STATUSES = ["backlog", "in_progress", "done", "cancelled"] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const FEATURE_STATUS_VARIANT: Record<FeatureStatus, "default" | "info" | "success" | "error"> = {
  backlog: "default",
  in_progress: "info",
  done: "success",
  cancelled: "error",
};

export const AGENT_STATUSES = ["idle", "running", "stopped"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  stopped: "Stopped",
};

export const RUN_STATUSES = ["queued", "running", "succeeded", "failed", "stopped", "timed_out"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STATUS_VARIANT: Record<RunStatus, "default" | "info" | "success" | "error" | "warning"> = {
  queued: "default",
  running: "info",
  succeeded: "success",
  failed: "error",
  stopped: "warning",
  timed_out: "error",
};

// Parsed stream event for display in the UI
export type RunEventData = {
  type: string;
  subtype?: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  isError?: boolean;
  sessionId?: string;
  model?: string;
  summary?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
};

// API response types

export type ApiResponse<T> = { data: T };
export type ApiError = { error: { code: string; message: string } };
