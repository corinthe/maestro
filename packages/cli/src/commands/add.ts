import {
  resolveAgentsPath,
  fileExists,
  readYaml,
  writeYaml,
} from '@maestro/core';
import type { Task } from '@maestro/core';

export interface AddOptions {
  depends?: string[];
}

export async function addCommand(title: string, opts: AddOptions): Promise<void> {
  const projectRoot = process.cwd();
  const agentsRoot = resolveAgentsPath(projectRoot);

  if (!(await fileExists(agentsRoot))) {
    console.error('No .ai-agents/ directory found. Run `maestro init` first.');
    process.exit(1);
  }

  const task: Task = {
    id: `task-${Date.now()}`,
    title,
    description: title,
    status: 'backlog',
    dependsOn: opts.depends?.length ? opts.depends : undefined,
  };

  const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
  const backlog = await readYaml<Task[]>(backlogPath).catch((): Task[] => []);
  backlog.push(task);
  await writeYaml(backlogPath, backlog);

  const GREEN = '\x1b[32m';
  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';

  console.log(`${GREEN}✓${RESET} Task added to backlog: ${task.title} ${DIM}(${task.id})${RESET}`);
}
