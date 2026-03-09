import type { Task, Agent } from '@maestro/core';
import {
  resolveAgentsPath,
  readYaml,
  writeYaml,
  writeJson,
  emitSignal,
} from '@maestro/core';
import { buildPlanningContext } from './context-builder.js';
import { createRunner } from '@maestro/runners';
import type { WebSocketServer } from 'ws';

/**
 * Finds and assigns a planner agent for a task in a planning phase.
 * Returns true if an agent was assigned, false if no suitable agent is available.
 */
export async function assignPlannerAgent(
  projectRoot: string,
  wss: WebSocketServer,
  task: Task
): Promise<boolean> {
  const phase = task.planningPhase;
  if (phase !== 'functional-planning' && phase !== 'technical-planning') {
    return false;
  }

  const planPhase = phase === 'functional-planning' ? 'functional' : 'technical';
  const requiredRole = `${planPhase}-planner`;

  // Load agents
  const agentsPath = resolveAgentsPath(projectRoot, 'config', 'agents.yaml');
  const agents = await readYaml<Agent[]>(agentsPath).catch(() => []);
  const enabledAgents = (Array.isArray(agents) ? agents : []).filter((a) => a.enabled !== false);

  // Find a planner agent with the right role
  const agent = enabledAgents.find((a) => a.role === requiredRole);
  if (!agent) {
    console.log(`[plan-runner] No agent with role "${requiredRole}" found`);
    return false;
  }

  // Check if agent is busy
  const statePath = resolveAgentsPath(projectRoot, 'agents', agent.name, 'state.json');
  const state = await readYaml<{ status: string }>(statePath).catch(() => ({ status: 'idle' }));
  if (state.status === 'working') {
    console.log(`[plan-runner] Agent "${agent.name}" is busy`);
    return false;
  }

  console.log(`[plan-runner] Assigning ${planPhase} planning for task "${task.id}" to agent "${agent.name}"`);

  // Update agent state
  await writeJson(statePath, {
    name: agent.name,
    status: 'working',
    currentTaskId: task.id,
    lastActiveAt: new Date().toISOString(),
  });

  // Build context and launch runner
  const contextPath = await buildPlanningContext(projectRoot, task, agent, planPhase);

  broadcast(wss, {
    type: 'task-assigned',
    taskId: task.id,
    agent: agent.name,
  });

  // Fire-and-forget
  launchPlanRunner(projectRoot, task, agent, contextPath, planPhase).catch((err) => {
    console.error(`[plan-runner] Runner error for task ${task.id}:`, err);
  });

  return true;
}

async function launchPlanRunner(
  projectRoot: string,
  task: Task,
  agent: Agent,
  contextPath: string,
  phase: 'functional' | 'technical'
): Promise<void> {
  const runner = createRunner(agent.runner);

  const isAvailable = await runner.isAvailable();
  if (!isAvailable) {
    console.error(`[plan-runner] Runner "${agent.runner}" is not available`);
    await emitSignal(projectRoot, {
      type: 'agent-error',
      taskId: task.id,
      agent: agent.name,
      summary: `Runner "${agent.runner}" is not available`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.log(`[plan-runner] Running agent "${agent.name}" for ${phase} planning on task "${task.id}"`);
  const result = await runner.run(agent, contextPath);

  if (result.success) {
    await emitSignal(projectRoot, {
      type: 'plan-ready',
      taskId: task.id,
      agent: agent.name,
      summary: `${phase} plan ready for review`,
      timestamp: new Date().toISOString(),
    });
  } else {
    await emitSignal(projectRoot, {
      type: 'agent-error',
      taskId: task.id,
      agent: agent.name,
      summary: result.error ?? `${phase} planning failed`,
      timestamp: new Date().toISOString(),
    });
  }
}

function broadcast(wss: WebSocketServer, data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
