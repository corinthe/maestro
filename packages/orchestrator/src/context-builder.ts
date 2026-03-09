import type { Task, Agent, PlanComment } from '@maestro/core';
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

export async function buildPlanningContext(
  projectRoot: string,
  task: Task,
  agent: Agent,
  phase: 'functional' | 'technical'
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

  // Include previous plan versions
  const planDir = resolveAgentsPath(projectRoot, 'tasks', 'plans', task.id);

  if (phase === 'technical') {
    // Include the approved functional plan
    const funcVersion = task.functionalPlanVersion ?? 1;
    const funcPlan = await readMarkdown(`${planDir}/functional-v${funcVersion}.md`).catch(() => '');
    if (funcPlan.trim()) {
      lines.push('## Approved Functional Plan');
      lines.push(funcPlan.trim());
      lines.push('');
    }
  }

  // Include previous version of the current phase plan (for revisions)
  const currentVersion = phase === 'functional'
    ? (task.functionalPlanVersion ?? 1)
    : (task.technicalPlanVersion ?? 1);

  if (currentVersion > 1) {
    const prevPlan = await readMarkdown(`${planDir}/${phase}-v${currentVersion - 1}.md`).catch(() => '');
    if (prevPlan.trim()) {
      lines.push(`## Previous ${phase} Plan (v${currentVersion - 1})`);
      lines.push(prevPlan.trim());
      lines.push('');
    }
  }

  // Include user comments for the current phase
  const comments = await readYaml<PlanComment[]>(`${planDir}/comments.yaml`).catch((): PlanComment[] => []);
  const phaseComments = comments.filter((c) => c.phase === phase);
  if (phaseComments.length > 0) {
    lines.push('## User Feedback');
    for (const comment of phaseComments) {
      lines.push(`- **[${comment.createdAt}]:** ${comment.content}`);
    }
    lines.push('');
  }

  // Output instructions
  const version = phase === 'functional'
    ? (task.functionalPlanVersion ?? 1)
    : (task.technicalPlanVersion ?? 1);
  const outputPath = `.ai-agents/tasks/plans/${task.id}/${phase}-v${version}.md`;

  lines.push('## Output');
  lines.push(`Write your ${phase} plan as Markdown to the file: \`${outputPath}\``);
  lines.push('');

  if (phase === 'functional') {
    lines.push('Your plan should include: user stories, acceptance criteria, scope boundaries, assumptions, and risks.');
  } else {
    lines.push('Your plan should include: architecture decisions, file changes needed, dependencies, sub-task decomposition, and implementation approach.');
  }
  lines.push('');

  // Signal instructions
  lines.push('## Completion');
  lines.push(
    'When you finish writing the plan, create a signal file at ' +
      `\`.ai-agents/signals/plan-ready-${task.id}.signal\` ` +
      'with the following YAML content:'
  );
  lines.push('```yaml');
  lines.push(`type: plan-ready`);
  lines.push(`taskId: ${task.id}`);
  lines.push(`agent: ${agent.name}`);
  lines.push(`summary: "${phase} plan v${version} ready for review"`);
  lines.push(`timestamp: "<ISO timestamp>"`);
  lines.push('```');

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
