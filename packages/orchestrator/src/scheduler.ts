import type { Task, Agent } from '@maestro/core';
import { getReadyTasks, detectFileConflicts } from '@maestro/core';
import type { LogFn } from './dispatch.js';

export interface Assignment {
  task: Task;
  agent: Agent;
}

export function scheduleNext(
  backlog: Task[],
  inProgress: Task[],
  agents: Agent[],
  log?: LogFn
): Assignment[] {
  const readyTasks = getReadyTasks(backlog);
  const busyAgents = new Set(inProgress.map((t) => t.agent));
  const enabledAgents = agents.filter((a) => a.enabled !== false);
  const availableAgents = enabledAgents.filter((a) => !busyAgents.has(a.name));
  const assignments: Assignment[] = [];

  log?.('debug', 'scheduler',
    `scheduleNext: ${readyTasks.length} ready task(s), ${availableAgents.length} available agent(s) ` +
    `[${availableAgents.map((a) => `${a.name}(${a.role})`).join(', ') || 'none'}]`
  );

  for (const task of readyTasks) {
    if (availableAgents.length === 0) {
      log?.('debug', 'scheduler', `No more available agents — stopping assignment loop`);
      break;
    }

    const conflicts = detectFileConflicts(inProgress, task);
    if (conflicts.length > 0) {
      log?.('debug', 'scheduler', `Task "${task.title}" (${task.id}) skipped — file conflicts: ${conflicts.join(', ')}`);
      continue;
    }

    const agent = availableAgents.find((a) => a.role === task.agent) ?? availableAgents[0];
    if (!agent) {
      log?.('debug', 'scheduler', `Task "${task.title}" (${task.id}) skipped — no matching agent`);
      continue;
    }

    log?.('debug', 'scheduler', `Task "${task.title}" (${task.id}) → agent "${agent.name}" (${agent.role})`);
    assignments.push({ task, agent });
    availableAgents.splice(availableAgents.indexOf(agent), 1);
  }

  return assignments;
}
