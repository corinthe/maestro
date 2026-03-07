import type { Task, Agent } from '@maestro/core';
import { getReadyTasks, detectFileConflicts } from '@maestro/core';

export interface Assignment {
  task: Task;
  agent: Agent;
}

export function scheduleNext(
  backlog: Task[],
  inProgress: Task[],
  agents: Agent[]
): Assignment[] {
  const readyTasks = getReadyTasks(backlog);
  const busyAgents = new Set(inProgress.map((t) => t.agent));
  const availableAgents = agents.filter((a) => !busyAgents.has(a.name));
  const assignments: Assignment[] = [];

  for (const task of readyTasks) {
    if (availableAgents.length === 0) break;

    const conflicts = detectFileConflicts(inProgress, task);
    if (conflicts.length > 0) continue;

    const agent = availableAgents.find((a) => a.role === task.agent) ?? availableAgents[0];
    if (!agent) continue;

    assignments.push({ task, agent });
    availableAgents.splice(availableAgents.indexOf(agent), 1);
  }

  return assignments;
}
