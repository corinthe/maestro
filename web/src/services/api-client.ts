import type { Task, TaskStatus, AgentSummary, AgentTemplate, TaskLogs, ProjectInfo, ProjectAgentInfo } from "../types/task";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new ApiError(
      body.message ?? "Erreur inconnue",
      body.code ?? "UNKNOWN_ERROR",
      response.status,
      body.suggestion,
    );
  }

  return body as T;
}

export function fetchTasks(status?: TaskStatus): Promise<Task[]> {
  const url = status ? `/api/tasks?status=${status}` : "/api/tasks";
  return request<Task[]>(url);
}

export function fetchTask(id: string): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`);
}

export function createTask(title: string, description: string): Promise<Task> {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export function updateTask(
  id: string,
  data: { title?: string; description?: string; status?: TaskStatus },
): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json();
    throw new ApiError(
      body.message ?? "Erreur inconnue",
      body.code ?? "UNKNOWN_ERROR",
      response.status,
      body.suggestion,
    );
  }
}

export function analyzeTask(id: string): Promise<Task> {
  return request<Task>(`/api/tasks/${id}/analyze`, { method: "POST" });
}

export function approveTask(id: string): Promise<Task> {
  return request<Task>(`/api/tasks/${id}/approve`, { method: "POST" });
}

export function cancelTask(id: string): Promise<Task> {
  return request<Task>(`/api/tasks/${id}/cancel`, { method: "POST" });
}

export function fetchTaskLogs(id: string): Promise<TaskLogs> {
  return request<TaskLogs>(`/api/tasks/${id}/logs`);
}

export function fetchAgents(): Promise<AgentSummary[]> {
  return request<AgentSummary[]>("/api/agents");
}

export function fetchAgent(name: string): Promise<AgentTemplate> {
  return request<AgentTemplate>(`/api/agents/${name}`);
}

export function fetchProjectInfo(): Promise<ProjectInfo> {
  return request<ProjectInfo>("/api/project");
}

export async function fetchProjectSoul(): Promise<string> {
  const response = await fetch("/api/project/soul");
  return response.text();
}

export function updateProjectConfig(config: Record<string, unknown>): Promise<{ config: ProjectInfo["config"] }> {
  return request<{ config: ProjectInfo["config"] }>("/api/project/config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function fetchProjectAgents(): Promise<ProjectAgentInfo[]> {
  return request<ProjectAgentInfo[]>("/api/project/agents");
}
