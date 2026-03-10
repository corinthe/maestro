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
import { assignPlannerAgent } from './plan-runner.js';
import { createRunner } from '@maestro/runners';
import type { WebSocketServer } from 'ws';

export type LogFn = (level: 'info' | 'warn' | 'error' | 'debug', agent: string, message: string) => void;

export interface DispatchDeps {
  projectRoot: string;
  wss: WebSocketServer;
  log?: LogFn;
  isPaused?: () => boolean;
}

/**
 * Creates a signal handler that routes signals to the appropriate orchestrator logic.
 */
export function createDispatcher(deps: DispatchDeps) {
  const { projectRoot, wss } = deps;

  // Unified log helper: calls deps.log (if wired) AND console.log for terminal visibility
  const log: LogFn = (level, agent, message) => {
    if (level === 'error') console.error(`[dispatch] [${agent}] ${message}`);
    else if (level === 'warn') console.warn(`[dispatch] [${agent}] ${message}`);
    else if (level === 'debug') console.debug(`[dispatch] [${agent}] ${message}`);
    else console.log(`[dispatch] [${agent}] ${message}`);
    deps.log?.(level, agent, message);
  };

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  async function loadBacklog(): Promise<Task[]> {
    const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
    return readYaml<Task[]>(backlogPath).catch(() => []);
  }

  async function loadInProgressTasks(): Promise<Task[]> {
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

  async function loadAgents(): Promise<Agent[]> {
    const agentsPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
    const raw = await readYaml<Agent[]>(agentsPath).catch(() => []);
    return Array.isArray(raw) ? raw : [];
  }

  async function findTask(taskId?: string): Promise<Task | undefined> {
    if (!taskId) return undefined;
    const inProgressPath = resolveAgentsPath(projectRoot, 'tasks', 'in-progress', `${taskId}.yaml`);
    const inProgressTask = await readYaml<Task>(inProgressPath).catch(() => undefined);
    if (inProgressTask) return inProgressTask;
    const backlog = await loadBacklog();
    return backlog.find((t) => t.id === taskId);
  }

  async function removeInProgressTask(taskId: string): Promise<void> {
    const fs = await import('node:fs/promises');
    const taskPath = resolveAgentsPath(projectRoot, 'tasks', 'in-progress', `${taskId}.yaml`);
    await fs.unlink(taskPath).catch(() => {});
  }

  async function removeFromBacklog(taskId: string): Promise<void> {
    const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
    const backlog = await readYaml<Task[]>(backlogPath).catch(() => []);
    const updated = backlog.filter((t) => t.id !== taskId);
    await writeYaml(backlogPath, updated);
  }

  async function updateAgentState(
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

  async function updateTaskInBacklog(task: Task): Promise<void> {
    const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
    const backlog = await readYaml<Task[]>(backlogPath).catch(() => []);
    const idx = backlog.findIndex((t) => t.id === task.id);
    if (idx !== -1) {
      backlog[idx] = task;
      await writeYaml(backlogPath, backlog);
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling & Running
  // ---------------------------------------------------------------------------

  async function launchRunner(task: Task, agent: Agent, contextPath: string): Promise<void> {
    const runner = createRunner(agent.runner);

    log('info', agent.name, `Checking runner availability: "${agent.runner}"...`);
    const isAvailable = await runner.isAvailable();
    if (!isAvailable) {
      log('error', agent.name, `Runner "${agent.runner}" is not available — is the CLI installed and in PATH?`);
      await emitSignal(projectRoot, {
        type: 'agent-error',
        taskId: task.id,
        agent: agent.name,
        summary: `Runner "${agent.runner}" is not available. Make sure the CLI is installed and in your PATH.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    log('info', agent.name, `Runner ready. Starting task "${task.title}" (${task.id})`);
    const result = await runner.run(agent, contextPath, {
      onOutput: ({ stream, text }) => {
        broadcast(wss, {
          type: 'agent-output',
          agent: agent.name,
          taskId: task.id,
          stream,
          text,
        });
      },
    });

    if (result.success) {
      log('info', agent.name, `Task "${task.id}" completed successfully. Summary: ${result.summary?.slice(0, 200) ?? '(no summary)'}`);
      await emitSignal(projectRoot, {
        type: 'task-completed',
        taskId: task.id,
        agent: agent.name,
        summary: result.summary,
        timestamp: new Date().toISOString(),
      });
    } else {
      log('error', agent.name, `Task "${task.id}" failed: ${result.error ?? 'unknown error'}`);
      await emitSignal(projectRoot, {
        type: 'agent-error',
        taskId: task.id,
        agent: agent.name,
        summary: result.error ?? 'Agent run failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async function scheduleAndRun(): Promise<void> {
    const backlog = await loadBacklog();
    const inProgress = await loadInProgressTasks();
    const agents = await loadAgents();

    const enabledAgents = agents.filter((a) => a.enabled !== false);
    const busyAgentNames = new Set(inProgress.map((t) => t.agent).filter(Boolean));
    const availableAgents = enabledAgents.filter((a) => !busyAgentNames.has(a.name));

    log('info', 'orchestrator',
      `Scheduling state: ${backlog.length} backlog task(s), ${inProgress.length} in-progress, ` +
      `${agents.length} agent(s) configured (${enabledAgents.length} enabled, ${availableAgents.length} available)`
    );

    if (agents.length === 0) {
      log('warn', 'orchestrator', 'No agents configured. Run `maestro init` or add agents via the dashboard.');
      return;
    }

    if (enabledAgents.length === 0) {
      log('warn', 'orchestrator', 'All agents are disabled. Enable at least one agent in the Agents tab.');
      return;
    }

    // Try to assign planner agents for tasks in planning phases
    const planningTasks = backlog.filter(
      (t) => t.planningPhase === 'functional-planning' || t.planningPhase === 'technical-planning'
    );
    if (planningTasks.length > 0) {
      log('info', 'orchestrator', `${planningTasks.length} task(s) in planning phase — assigning planner agents`);
      for (const task of planningTasks) {
        await assignPlannerAgent(projectRoot, wss, task);
      }
    }

    const readyTasks = backlog.filter(
      (t) => t.status === 'backlog' && (!t.planningPhase || t.planningPhase === 'approved')
    );

    if (backlog.length === 0) {
      log('debug', 'orchestrator', 'Backlog is empty — nothing to schedule');
      return;
    }

    if (readyTasks.length === 0) {
      const waitingOnPlanning = backlog.filter((t) => t.planningPhase && t.planningPhase !== 'approved').length;
      const waitingOnDeps = backlog.length - waitingOnPlanning;
      log('info', 'orchestrator',
        `No ready tasks (${waitingOnPlanning} waiting on planning approval, ${waitingOnDeps} waiting on dependencies or other)`
      );
      return;
    }

    log('info', 'orchestrator', `${readyTasks.length} task(s) ready for assignment`);

    const assignments = scheduleNext(backlog, inProgress, agents, log);

    if (assignments.length === 0) {
      if (availableAgents.length === 0) {
        log('info', 'orchestrator',
          `No assignments: all ${busyAgentNames.size} agent(s) are busy (in-progress: ${inProgress.map((t) => t.id).join(', ')})`
        );
      } else {
        log('info', 'orchestrator',
          'No assignments: tasks may have file conflicts or unmet dependencies'
        );
      }
      return;
    }

    for (const { task, agent } of assignments) {
      log('info', 'orchestrator', `Assigning task "${task.title}" (${task.id}) → agent "${agent.name}" (${agent.role})`);

      task.status = 'in-progress';
      task.agent = agent.name;
      task.startedAt = new Date().toISOString();

      const taskPath = resolveAgentsPath(projectRoot, 'tasks', 'in-progress', `${task.id}.yaml`);
      await writeYaml(taskPath, task);
      await removeFromBacklog(task.id);
      await updateAgentState(agent.name, 'working', task.id);

      const allInProgress = await loadInProgressTasks();
      const contextPath = await buildCurrentContext(projectRoot, task, agent, allInProgress);
      log('debug', agent.name, `Context built at: ${contextPath}`);

      broadcast(wss, { type: 'task-assigned', taskId: task.id, agent: agent.name });

      launchRunner(task, agent, contextPath).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        log('error', agent.name, `Runner launch error for task ${task.id}: ${msg}`);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Signal Handlers
  // ---------------------------------------------------------------------------

  async function handleNewObjective(signal: Signal): Promise<void> {
    const objective = signal.summary;
    if (!objective) {
      log('error', 'orchestrator', 'new-objective signal missing summary');
      return;
    }

    log('info', 'orchestrator', `Decomposing objective: "${objective}"`);
    const tasks = await decomposeObjective(projectRoot, objective);
    log('info', 'orchestrator', `Created ${tasks.length} task(s) in backlog`);

    broadcast(wss, { type: 'objective-decomposed', objective, taskCount: tasks.length });
    await scheduleAndRun();
  }

  async function handleTaskCompleted(signal: Signal): Promise<void> {
    const task = await findTask(signal.taskId);
    if (!task) {
      log('error', 'orchestrator', `task-completed: task ${signal.taskId} not found`);
      return;
    }

    const result: AgentRunResult = { success: true, summary: signal.summary ?? '' };

    log('info', signal.agent ?? 'orchestrator', `Task completed: "${task.title}" (${task.id})`);
    await consolidateTask(projectRoot, task, result);
    await removeInProgressTask(task.id);

    if (signal.agent) {
      await updateAgentState(signal.agent, 'idle');
      log('debug', signal.agent, `Agent is now idle`);
    }

    broadcast(wss, { type: 'task-completed', taskId: task.id, agent: signal.agent });
    await scheduleAndRun();
  }

  async function handleTaskBlocked(signal: Signal): Promise<void> {
    const task = await findTask(signal.taskId);
    if (!task) {
      log('error', 'orchestrator', `task-blocked: task ${signal.taskId} not found`);
      return;
    }

    const result: AgentRunResult = { success: false, summary: '', error: signal.summary ?? 'Task blocked' };

    log('warn', signal.agent ?? 'orchestrator', `Task blocked: "${task.title}" (${task.id}) — ${signal.summary}`);
    await consolidateTask(projectRoot, task, result);
    await removeInProgressTask(task.id);

    if (signal.agent) {
      await updateAgentState(signal.agent, 'idle');
    }

    broadcast(wss, { type: 'task-blocked', taskId: task.id, agent: signal.agent, reason: signal.summary });
    await scheduleAndRun();
  }

  async function handleAgentError(signal: Signal): Promise<void> {
    log('error', signal.agent ?? 'orchestrator', `Agent error: ${signal.summary}`);

    const item: HumanQueueItem = {
      id: `error-${Date.now()}`,
      type: 'error',
      title: `Agent error: ${signal.agent ?? 'unknown'}`,
      description: signal.summary ?? 'Unknown error occurred',
      context: { taskId: signal.taskId, agent: signal.agent },
      createdAt: new Date().toISOString(),
    };

    const itemPath = resolveAgentsPath(projectRoot, 'human-queue', `${item.id}.yaml`);
    await writeYaml(itemPath, item);

    if (signal.taskId) {
      const task = await findTask(signal.taskId);
      if (task) {
        const result: AgentRunResult = { success: false, summary: '', error: `Agent error: ${signal.summary}` };
        await consolidateTask(projectRoot, task, result);
        await removeInProgressTask(task.id);
      }
    }

    if (signal.agent) {
      await updateAgentState(signal.agent, 'idle');
    }

    broadcast(wss, { type: 'agent-error', taskId: signal.taskId, agent: signal.agent, error: signal.summary, escalated: true });
  }

  async function handlePlanReady(signal: Signal): Promise<void> {
    const task = await findTask(signal.taskId);
    if (!task) {
      log('error', 'orchestrator', `plan-ready: task ${signal.taskId} not found`);
      return;
    }

    if (task.planningPhase === 'functional-planning') {
      task.planningPhase = 'functional-review';
    } else if (task.planningPhase === 'technical-planning') {
      task.planningPhase = 'technical-review';
    } else {
      log('warn', 'orchestrator', `plan-ready: unexpected phase ${task.planningPhase}`);
      return;
    }

    await updateTaskInBacklog(task);

    if (signal.agent) {
      await updateAgentState(signal.agent, 'idle');
    }

    broadcast(wss, { type: 'plan-ready', taskId: task.id, planningPhase: task.planningPhase, agent: signal.agent });
    log('info', 'orchestrator', `Plan ready for review: ${task.id} (${task.planningPhase})`);
  }

  async function handlePlanApproved(signal: Signal): Promise<void> {
    const task = await findTask(signal.taskId);
    if (!task) {
      log('error', 'orchestrator', `plan-approved: task ${signal.taskId} not found`);
      return;
    }

    if (task.planningPhase === 'technical-planning') {
      log('info', 'orchestrator', `Starting technical planning for task ${task.id}`);
      await assignPlannerAgent(projectRoot, wss, task);
    } else if (task.planningPhase === 'approved') {
      log('info', 'orchestrator', `Task ${task.id} planning complete, ready for implementation`);
      await scheduleAndRun();
    }
  }

  async function handlePlanRevisionRequested(signal: Signal): Promise<void> {
    const task = await findTask(signal.taskId);
    if (!task) {
      log('error', 'orchestrator', `plan-revision-requested: task ${signal.taskId} not found`);
      return;
    }

    log('info', 'orchestrator', `Revision requested for task ${task.id} (${task.planningPhase})`);
    await assignPlannerAgent(projectRoot, wss, task);
  }

  // ---------------------------------------------------------------------------
  // Main dispatcher
  // ---------------------------------------------------------------------------

  return async (signal: Signal): Promise<void> => {
    if (deps.isPaused?.()) {
      log('debug', 'orchestrator', `Signal "${signal.type}" skipped — orchestrator is paused`);
      return;
    }

    log(
      'info',
      'orchestrator',
      `Signal received: ${signal.type}` +
        (signal.taskId ? ` (task: ${signal.taskId})` : '') +
        (signal.agent ? ` (agent: ${signal.agent})` : '')
    );

    switch (signal.type) {
      case 'new-objective':
        await handleNewObjective(signal);
        break;
      case 'task-completed':
        await handleTaskCompleted(signal);
        break;
      case 'task-blocked':
        await handleTaskBlocked(signal);
        break;
      case 'agent-error':
        await handleAgentError(signal);
        break;
      case 'plan-ready':
        await handlePlanReady(signal);
        break;
      case 'plan-approved':
        await handlePlanApproved(signal);
        break;
      case 'plan-revision-requested':
        await handlePlanRevisionRequested(signal);
        break;
      case 'wake':
        await scheduleAndRun();
        break;
      default:
        log('warn', 'orchestrator', `Unknown signal type: ${(signal as Signal).type}`);
    }
  };
}

function broadcast(wss: WebSocketServer, data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
