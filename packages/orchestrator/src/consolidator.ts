import type { Task, AgentRunResult } from '@maestro/core';
import { resolveAgentsPath, writeYaml, writeMarkdown, readMarkdown } from '@maestro/core';

export async function consolidateTask(
  projectRoot: string,
  task: Task,
  result: AgentRunResult
): Promise<void> {
  const completedTask: Task = {
    ...task,
    status: result.success ? 'done' : 'blocked',
    completedAt: new Date().toISOString(),
    blockedReason: result.error,
  };

  const targetDir = result.success ? 'done' : 'blocked';
  const taskPath = resolveAgentsPath(projectRoot, 'tasks', targetDir, `${task.id}.yaml`);
  await writeYaml(taskPath, completedTask);

  if (result.success && task.agent) {
    await updateAgentMemory(projectRoot, task.agent, result.summary);
  }
}

async function updateAgentMemory(
  projectRoot: string,
  agentName: string,
  summary: string
): Promise<void> {
  const memoryPath = resolveAgentsPath(projectRoot, 'agents', agentName, 'memory.md');
  const existing = await readMarkdown(memoryPath).catch(() => '');
  const entry = `\n## ${new Date().toISOString()}\n\n${summary}\n`;
  await writeMarkdown(memoryPath, existing + entry);
}
