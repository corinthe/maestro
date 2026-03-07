import type { Task, Agent } from '@maestro/core';
import {
  resolveAgentsPath,
  readMarkdown,
  writeMarkdown,
  readYaml,
} from '@maestro/core';

export async function buildCurrentContext(
  projectRoot: string,
  task: Task,
  agent: Agent,
  inProgressTasks: Task[]
): Promise<string> {
  const lines: string[] = [];

  // Agent identity
  lines.push(`# Agent: ${agent.name}`);
  lines.push(`**Role:** ${agent.role}`);
  lines.push('');
  lines.push('## System Prompt');
  lines.push(agent.systemPrompt);
  lines.push('');

  // Task details
  lines.push('## Task');
  lines.push(`**ID:** ${task.id}`);
  lines.push(`**Title:** ${task.title}`);
  lines.push('');
  lines.push(task.description);
  lines.push('');

  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    lines.push('### Acceptance Criteria');
    for (const criterion of task.acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
    lines.push('');
  }

  // Files the agent can modify
  if (task.filesLocked && task.filesLocked.length > 0) {
    lines.push('## Files You Can Modify');
    for (const file of task.filesLocked) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  // Files locked by other agents (off-limits)
  const otherLocked = new Set<string>();
  for (const other of inProgressTasks) {
    if (other.id === task.id) continue;
    if (other.filesLocked) {
      for (const f of other.filesLocked) {
        otherLocked.add(f);
      }
    }
  }
  if (otherLocked.size > 0) {
    lines.push('## Files Off-Limits (Locked by Other Agents)');
    for (const file of otherLocked) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  // Agent memory
  const memoryPath = resolveAgentsPath(projectRoot, 'agents', agent.name, 'memory.md');
  const memory = await readMarkdown(memoryPath).catch(() => '');
  if (memory.trim()) {
    lines.push('## Your Memory');
    lines.push(memory.trim());
    lines.push('');
  }

  // Signal instructions
  lines.push('## Completion');
  lines.push(
    'When you finish this task, create a signal file at ' +
      `\`.ai-agents/signals/task-completed-${task.id}.signal\` ` +
      'with the following YAML content:'
  );
  lines.push('```yaml');
  lines.push(`type: task-completed`);
  lines.push(`taskId: ${task.id}`);
  lines.push(`agent: ${agent.name}`);
  lines.push(`summary: "<brief summary of what you did>"`);
  lines.push(`timestamp: "<ISO timestamp>"`);
  lines.push('```');
  lines.push('');
  lines.push(
    'If you encounter a blocking issue, create a signal file at ' +
      `\`.ai-agents/signals/task-blocked-${task.id}.signal\` instead, ` +
      'using `type: task-blocked`.'
  );

  const content = lines.join('\n');

  // Write to agent's context file
  const contextPath = resolveAgentsPath(
    projectRoot,
    'agents',
    agent.name,
    'current-context.md'
  );
  await writeMarkdown(contextPath, content);

  return contextPath;
}
