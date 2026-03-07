import * as fs from 'node:fs/promises';
import {
  resolveAgentsPath,
  fileExists,
  readYaml,
  readJson,
} from '@maestro/core';
import type { Task, AgentState, HumanQueueItem } from '@maestro/core';

export async function statusCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const agentsRoot = resolveAgentsPath(projectRoot);

  if (!(await fileExists(agentsRoot))) {
    console.error('No .ai-agents/ directory found. Run `maestro init` first.');
    process.exit(1);
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
  const backlogTasks = await readYaml<Task[]>(backlogPath).catch((): Task[] => []);

  const countDir = async (status: string): Promise<number> => {
    const dir = resolveAgentsPath(projectRoot, 'tasks', status);
    try {
      const files = await fs.readdir(dir);
      return files.filter((f) => f.endsWith('.yaml')).length;
    } catch {
      return 0;
    }
  };

  const inProgressCount = await countDir('in-progress');
  const doneCount = await countDir('done');
  const blockedCount = await countDir('blocked');

  // ── In-progress task details ────────────────────────────────────────────
  const inProgressTasks: Task[] = [];
  const ipDir = resolveAgentsPath(projectRoot, 'tasks', 'in-progress');
  try {
    const files = await fs.readdir(ipDir);
    for (const file of files.filter((f) => f.endsWith('.yaml'))) {
      const task = await readYaml<Task>(`${ipDir}/${file}`);
      inProgressTasks.push(task);
    }
  } catch { /* directory may not exist */ }

  // ── Agents ──────────────────────────────────────────────────────────────
  interface AgentInfo { name: string; status: string; currentTaskId?: string }
  const agents: AgentInfo[] = [];
  const agentsDir = resolveAgentsPath(projectRoot, 'agents');
  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const statePath = `${agentsDir}/${entry.name}/state.json`;
      const state = await readJson<AgentState>(statePath).catch((): AgentState => ({
        name: entry.name,
        status: 'idle',
      }));
      agents.push(state);
    }
  } catch { /* agents/ may not exist */ }

  // ── Human queue ─────────────────────────────────────────────────────────
  const pendingItems: HumanQueueItem[] = [];
  const hqDir = resolveAgentsPath(projectRoot, 'human-queue');
  try {
    const files = await fs.readdir(hqDir);
    for (const file of files.filter((f) => f.endsWith('.yaml'))) {
      const item = await readYaml<HumanQueueItem>(`${hqDir}/${file}`);
      if (!item.resolvedAt) pendingItems.push(item);
    }
  } catch { /* directory may not exist */ }

  // ── Render ──────────────────────────────────────────────────────────────
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const RED = '\x1b[31m';
  const CYAN = '\x1b[36m';
  const MAGENTA = '\x1b[35m';

  console.log();
  console.log(`${BOLD}  Maestro Status${RESET}`);
  console.log(`${DIM}  ${'─'.repeat(40)}${RESET}`);

  // Tasks summary
  console.log();
  console.log(`${BOLD}  Tasks${RESET}`);
  console.log(`    ${CYAN}backlog${RESET}       ${backlogTasks.length}`);
  console.log(`    ${YELLOW}in-progress${RESET}   ${inProgressCount}`);
  console.log(`    ${GREEN}done${RESET}          ${doneCount}`);
  console.log(`    ${RED}blocked${RESET}       ${blockedCount}`);

  // In-progress detail
  if (inProgressTasks.length > 0) {
    console.log();
    console.log(`${BOLD}  Active Tasks${RESET}`);
    for (const task of inProgressTasks) {
      const agent = task.agent ? `${DIM}(${task.agent})${RESET}` : '';
      console.log(`    ${YELLOW}▸${RESET} ${task.title} ${agent}`);
    }
  }

  // Agents
  if (agents.length > 0) {
    console.log();
    console.log(`${BOLD}  Agents${RESET}`);
    for (const a of agents) {
      const color = a.status === 'working' ? GREEN : a.status === 'waiting' ? YELLOW : DIM;
      const taskInfo = a.currentTaskId ? ` ${DIM}→ ${a.currentTaskId}${RESET}` : '';
      console.log(`    ${color}●${RESET} ${a.name} ${color}${a.status}${RESET}${taskInfo}`);
    }
  }

  // Human queue
  if (pendingItems.length > 0) {
    console.log();
    console.log(`${BOLD}${MAGENTA}  Human Queue (${pendingItems.length} pending)${RESET}`);
    for (const item of pendingItems) {
      console.log(`    ${MAGENTA}!${RESET} [${item.type}] ${item.title}`);
    }
  }

  console.log();
}
