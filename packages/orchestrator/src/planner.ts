import type { Task } from '@maestro/core';
import { readYaml, writeYaml, resolveAgentsPath } from '@maestro/core';

export async function decomposeObjective(
  projectRoot: string,
  objective: string
): Promise<Task[]> {
  // TODO: Use an AI agent to decompose the objective into tasks
  // For now, create a single task from the objective
  const task: Task = {
    id: `task-${Date.now()}`,
    title: objective,
    description: objective,
    status: 'backlog',
  };

  const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
  const existing = await readYaml<Task[]>(backlogPath).catch(() => []);
  const updated = [...existing, task];
  await writeYaml(backlogPath, updated);

  return [task];
}
