import type { Signal, Task, Agent, AgentRunResult, HumanQueueItem } from '@maestro/core';
import {
  resolveAgentsPath,
  readYaml,
  writeYaml,
  writeJson,
  emitSignal,
} from '@maestro/core';
import { decomposeObjective } from './planner.js';
import { scheduleNext } from './scheduler.js';
import { consolidateTask } from './consolidator.js';
import { buildCurrentContext } from './context-builder.js';
import { createRunner } from '@maestro/runners';
import type { WebSocketServer } from 'ws';

export interface DispatchDeps {
  projectRoot: string;
  wss: WebSocketServer;
}

/**
 * Creates a signal handler that routes signals to the appropriate orchestrator logic.
 */
export function createDispatcher(deps: DispatchDeps) {
  const { projectRoot, wss } = deps;

  return async (signal: Signal): Promise<void> => {
    console.log(
      `[dispatch] Handling signal: ${signal.type}` +
        (signal.taskId ? ` (task: ${signal.taskId})` : '') +
        (signal.agent ? ` (agent: ${signal.agent})` : '')
    );

    switch (signal.type) {
      case 'new-objective':
        await handleNewObjective(projectRoot, wss, signal);
        break;
      case 'task-completed':
        await handleTaskCompleted(projectRoot, wss, signal);
        break;
      case 'task-blocked':
        await handleTaskBlocked(projectRoot, wss, signal);
        break;
      case 'agent-error':
        await handleAgentError(projectRoot, wss, signal);
        break;
      case 'wake':
        await scheduleAndRun(projectRoot, wss);
        break;
      default:
        console.warn(`[dispatch] Unknown signal type: ${(signal as Signal).type}`);
    }
  };
}

// ---------------------------------------------------------------------------
// Signal Handlers
// ---------------------------------------------------------------------------

async function handleNewObjective(
  projectRoot: string,
  wss: WebSocketServer,
  signal: Signal
): Promise<void> {
  const objective = signal.summary;
  if (!objective) {
    console.error('[dispatch] new-objective signal missing summary');
    return;
  }

  console.log(`[dispatch] Decomposing objective: "${objective}"`);
  const tasks = await decomposeObjective(projectRoot, objective);
  console.log(`[dispatch] Created ${tasks.length} task(s) in backlog`);

  broadcast(wss, { type: 'objective-decomposed', objective, taskCount: tasks.length });

  // Immediately try to schedule
  await scheduleAndRun(projectRoot, wss);
}

async function handleTaskCompleted(
  projectRoot: string,
  wss: WebSocketServer,
  signal: Signal
): Promise<void> {
  const task = await findTask(projectRoot, signal.taskId);
  if (!task) {
    console.error(`[dispatch] task-completed: task ${signal.taskId} not found`);
    return;
  }

  const result: AgentRunResult = {
    success: true,
    summary: signal.summary ?? '',
  };

  console.log(`[dispatch] Consolidating completed task: ${task.id}`);
  await consolidateTask(projectRoot, task, result);

  // Remove from in-progress
  await removeInProgressTask(projectRoot, task.id);

  // Update agent state to idle
  if (signal.agent) {
    await updateAgentState(projectRoot, signal.agent, 'idle');
  }

  broadcast(wss, { type: 'task-completed', taskId: task.id, agent: signal.agent });

  // Schedule next tasks
  await scheduleAndRun(projectRoot, wss);
}

async function handleTaskBlocked(
  projectRoot: string,
  wss: WebSocketServer,
  signal: Signal
): Promise<void> {
  const task = await findTask(projectRoot, signal.taskId);
  if (!task) {
    console.error(`[dispatch] task-blocked: task ${signal.taskId} not found`);
    return;
  }

  const result: AgentRunResult = {
    success: false,
    summary: '',
    error: signal.summary ?? 'Task blocked',
  };

  console.log(`[dispatch] Task blocked: ${task.id} — ${signal.summary}`);
  await consolidateTask(projectRoot, task, result);
  await removeInProgressTask(projectRoot, task.id);

  if (signal.agent) {
    await updateAgentState(projectRoot, signal.agent, 'idle');
  }

  broadcast(wss, {
    type: 'task-blocked',
    taskId: task.id,
    agent: signal.agent,
    reason: signal.summary,
  });

  // Try scheduling other tasks
  await scheduleAndRun(projectRoot, wss);
}

async function handleAgentError(
  projectRoot: string,
  wss: WebSocketServer,
  signal: Signal
): Promise<void> {
  console.error(
    `[dispatch] Agent error: ${signal.agent ?? 'unknown'} — ${signal.summary}`
  );

  // Escalate to human queue
  const item: HumanQueueItem = {
    id: `error-${Date.now()}`,
    type: 'error',
    title: `Agent error: ${signal.agent ?? 'unknown'}`,
    description: signal.summary ?? 'Unknown error occurred',
    context: {
      taskId: signal.taskId,
      agent: signal.agent,
    },
    createdAt: new Date().toISOString(),
  };

  const itemPath = resolveAgentsPath(projectRoot, 'human-queue', `${item.id}.yaml`);
  await writeYaml(itemPath, item);

  // If there's a task associated, mark it blocked
  if (signal.taskId) {
    const task = await findTask(projectRoot, signal.taskId);
    if (task) {
      const result: AgentRunResult = {
        success: false,
        summary: '',
        error: `Agent error: ${signal.summary}`,
      };
      await consolidateTask(projectRoot, task, result);
      await removeInProgressTask(projectRoot, task.id);
    }
  }

  if (signal.agent) {
    await updateAgentState(projectRoot, signal.agent, 'idle');
  }

  broadcast(wss, {
    type: 'agent-error',
    taskId: signal.taskId,
    agent: signal.agent,
    error: signal.summary,
    escalated: true,
  });
}

// ---------------------------------------------------------------------------
// Scheduling & Running
// ---------------------------------------------------------------------------

async function scheduleAndRun(
  projectRoot: string,
  wss: WebSocketServer
): Promise<void> {
  const backlog = await loadBacklog(projectRoot);
  const inProgress = await loadInProgressTasks(projectRoot);
  const agents = await loadAgents(projectRoot);

  if (backlog.length === 0) {
    console.log('[dispatch] No tasks in backlog');
    return;
  }

  const assignments = scheduleNext(backlog, inProgress, agents);

  if (assignments.length === 0) {
    console.log('[dispatch] No tasks could be assigned (all agents busy or conflicts)');
    return;
  }

  for (const { task, agent } of assignments) {
    console.log(`[dispatch] Assigning task "${task.title}" to agent "${agent.name}"`);

    // Move task to in-progress
    task.status = 'in-progress';
    task.agent = agent.name;
    task.startedAt = new Date().toISOString();

    const taskPath = resolveAgentsPath(projectRoot, 'tasks', 'in-progress', `${task.id}.yaml`);
    await writeYaml(taskPath, task);

    // Remove from backlog
    await removeFromBacklog(projectRoot, task.id);

    // Update agent state
    await updateAgentState(projectRoot, agent.name, 'working', task.id);

    // Build context and launch runner
    const allInProgress = await loadInProgressTasks(projectRoot);
    const contextPath = await buildCurrentContext(projectRoot, task, agent, allInProgress);

    broadcast(wss, {
      type: 'task-assigned',
      taskId: task.id,
      agent: agent.name,
    });

    // Fire-and-forget: launch the runner, emit signal on completion
    launchRunner(projectRoot, task, agent, contextPath).catch((err) => {
      console.error(`[dispatch] Runner launch error for task ${task.id}:`, err);
    });
  }
}

async function launchRunner(
  projectRoot: string,
  task: Task,
  agent: Agent,
  contextPath: string
): Promise<void> {
  const runner = createRunner(agent.runner);

  const isAvailable = await runner.isAvailable();
  if (!isAvailable) {
    console.error(`[dispatch] Runner "${agent.runner}" is not available`);
    await emitSignal(projectRoot, {
      type: 'agent-error',
      taskId: task.id,
      agent: agent.name,
      summary: `Runner "${agent.runner}" is not available`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.log(`[dispatch] Running agent "${agent.name}" on task "${task.id}"`);
  const result = await runner.run(agent, contextPath);

  if (result.success) {
    await emitSignal(projectRoot, {
      type: 'task-completed',
      taskId: task.id,
      agent: agent.name,
      summary: result.summary,
      timestamp: new Date().toISOString(),
    });
  } else {
    await emitSignal(projectRoot, {
      type: 'agent-error',
      taskId: task.id,
      agent: agent.name,
      summary: result.error ?? 'Agent run failed',
      timestamp: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function loadBacklog(projectRoot: string): Promise<Task[]> {
  const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
  return readYaml<Task[]>(backlogPath).catch(() => []);
}

async function loadInProgressTasks(projectRoot: string): Promise<Task[]> {
  const dir = resolveAgentsPath(projectRoot, 'tasks', 'in-progress');
  const fs = await import('node:fs/promises');
  try {
    const files = await fs.readdir(dir);
    const tasks: Task[] = [];
    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const task = await readYaml<Task>(`${dir}/${file}`);
        tasks.push(task);
      }
    }
    return tasks;
  } catch {
    return [];
  }
}

async function loadAgents(projectRoot: string): Promise<Agent[]> {
  const agentsPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
  const raw = await readYaml<Agent[]>(agentsPath).catch(() => []);
  return Array.isArray(raw) ? raw : [];
}

async function findTask(projectRoot: string, taskId?: string): Promise<Task | undefined> {
  if (!taskId) return undefined;

  // Check in-progress first
  const inProgressPath = resolveAgentsPath(projectRoot, 'tasks', 'in-progress', `${taskId}.yaml`);
  const inProgressTask = await readYaml<Task>(inProgressPath).catch(() => undefined);
  if (inProgressTask) return inProgressTask;

  // Check backlog
  const backlog = await loadBacklog(projectRoot);
  return backlog.find((t) => t.id === taskId);
}

async function removeInProgressTask(projectRoot: string, taskId: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const taskPath = resolveAgentsPath(projectRoot, 'tasks', 'in-progress', `${taskId}.yaml`);
  await fs.unlink(taskPath).catch(() => {});
}

async function removeFromBacklog(projectRoot: string, taskId: string): Promise<void> {
  const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
  const backlog = await readYaml<Task[]>(backlogPath).catch(() => []);
  const updated = backlog.filter((t) => t.id !== taskId);
  await writeYaml(backlogPath, updated);
}

async function updateAgentState(
  projectRoot: string,
  agentName: string,
  status: 'idle' | 'working' | 'waiting',
  taskId?: string
): Promise<void> {
  const statePath = resolveAgentsPath(projectRoot, 'agents', agentName, 'state.json');
  await writeJson(statePath, {
    name: agentName,
    status,
    currentTaskId: taskId ?? null,
    lastActiveAt: new Date().toISOString(),
  });
}

function broadcast(wss: WebSocketServer, data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
