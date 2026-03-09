import { Router } from 'express';
import * as fs from 'node:fs/promises';
import type { WebSocketServer } from 'ws';
import type { Task, PlanComment } from '@maestro/core';
import { resolveAgentsPath, readYaml, writeYaml, readMarkdown, emitSignal } from '@maestro/core';
import { appendLog } from '../logger.js';
import { broadcast } from '../broadcast.js';
import { loadBacklog } from './tasks.js';

export function createTaskPlanRoutes(wss: WebSocketServer, projectRoot: string) {
  const router = Router();

  // ── GET /api/tasks/:taskId/plan ──────────────────────────────────────────
  router.get('/api/tasks/:taskId/plan', async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await findTaskById(projectRoot, taskId);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const planDir = resolveAgentsPath(projectRoot, 'tasks', 'plans', taskId);

      // Read plan documents
      let functionalPlan = '';
      let technicalPlan = '';

      const funcVersion = task.functionalPlanVersion ?? 1;
      const techVersion = task.technicalPlanVersion ?? 1;

      try {
        functionalPlan = await readMarkdown(`${planDir}/functional-v${funcVersion}.md`);
      } catch { /* not yet created */ }

      try {
        technicalPlan = await readMarkdown(`${planDir}/technical-v${techVersion}.md`);
      } catch { /* not yet created */ }

      // Read comments
      const comments = await readYaml<PlanComment[]>(`${planDir}/comments.yaml`).catch((): PlanComment[] => []);

      res.json({
        taskId,
        planningPhase: task.planningPhase ?? null,
        functionalPlanVersion: funcVersion,
        technicalPlanVersion: techVersion,
        functionalPlan,
        technicalPlan,
        comments,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load plan data' });
    }
  });

  // ── POST /api/tasks/:taskId/plan/approve ─────────────────────────────────
  router.post('/api/tasks/:taskId/plan/approve', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { phase } = req.body as { phase?: 'functional' | 'technical' };

      if (!phase || (phase !== 'functional' && phase !== 'technical')) {
        res.status(400).json({ error: 'phase must be "functional" or "technical"' });
        return;
      }

      const task = await findTaskById(projectRoot, taskId);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const expectedPhase = phase === 'functional' ? 'functional-review' : 'technical-review';
      if (task.planningPhase !== expectedPhase) {
        res.status(400).json({ error: `Task is not in ${expectedPhase} phase (current: ${task.planningPhase ?? 'none'})` });
        return;
      }

      // Advance phase
      if (phase === 'functional') {
        task.planningPhase = 'technical-planning';
        task.technicalPlanVersion = 1;
      } else {
        task.planningPhase = 'approved';
      }

      await updateTaskInBacklog(projectRoot, task);

      await emitSignal(projectRoot, {
        type: 'plan-approved',
        taskId: task.id,
        summary: `${phase} plan approved`,
        timestamp: new Date().toISOString(),
      });

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Plan approved: ${phase} for task ${taskId}` });
      broadcast(wss, { type: 'plan-approved', taskId, phase, planningPhase: task.planningPhase });

      res.json({ taskId, planningPhase: task.planningPhase });
    } catch {
      res.status(500).json({ error: 'Failed to approve plan' });
    }
  });

  // ── POST /api/tasks/:taskId/plan/request-changes ─────────────────────────
  router.post('/api/tasks/:taskId/plan/request-changes', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { phase, comment } = req.body as { phase?: 'functional' | 'technical'; comment?: string };

      if (!phase || (phase !== 'functional' && phase !== 'technical')) {
        res.status(400).json({ error: 'phase must be "functional" or "technical"' });
        return;
      }
      if (!comment || !comment.trim()) {
        res.status(400).json({ error: 'comment is required when requesting changes' });
        return;
      }

      const task = await findTaskById(projectRoot, taskId);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const expectedPhase = phase === 'functional' ? 'functional-review' : 'technical-review';
      if (task.planningPhase !== expectedPhase) {
        res.status(400).json({ error: `Task is not in ${expectedPhase} phase (current: ${task.planningPhase ?? 'none'})` });
        return;
      }

      // Save comment
      const planDir = resolveAgentsPath(projectRoot, 'tasks', 'plans', taskId);
      await fs.mkdir(planDir, { recursive: true });

      const comments = await readYaml<PlanComment[]>(`${planDir}/comments.yaml`).catch((): PlanComment[] => []);
      const newComment: PlanComment = {
        id: `comment-${Date.now()}`,
        taskId,
        phase,
        content: comment.trim(),
        createdAt: new Date().toISOString(),
      };
      comments.push(newComment);
      await writeYaml(`${planDir}/comments.yaml`, comments);

      // Reset to planning phase and increment version
      if (phase === 'functional') {
        task.planningPhase = 'functional-planning';
        task.functionalPlanVersion = (task.functionalPlanVersion ?? 1) + 1;
      } else {
        task.planningPhase = 'technical-planning';
        task.technicalPlanVersion = (task.technicalPlanVersion ?? 1) + 1;
      }

      await updateTaskInBacklog(projectRoot, task);

      await emitSignal(projectRoot, {
        type: 'plan-revision-requested',
        taskId: task.id,
        summary: comment.trim(),
        timestamp: new Date().toISOString(),
      });

      appendLog({ timestamp: new Date().toISOString(), agent: 'system', level: 'info', message: `Changes requested: ${phase} plan for task ${taskId}` });
      broadcast(wss, { type: 'plan-revision-requested', taskId, phase, planningPhase: task.planningPhase, comment: newComment });

      res.json({ taskId, planningPhase: task.planningPhase, comment: newComment });
    } catch {
      res.status(500).json({ error: 'Failed to request changes' });
    }
  });

  // ── POST /api/tasks/:taskId/plan/comments ────────────────────────────────
  router.post('/api/tasks/:taskId/plan/comments', async (req, res) => {
    try {
      const { taskId } = req.params;
      const { phase, content } = req.body as { phase?: 'functional' | 'technical'; content?: string };

      if (!phase || (phase !== 'functional' && phase !== 'technical')) {
        res.status(400).json({ error: 'phase must be "functional" or "technical"' });
        return;
      }
      if (!content || !content.trim()) {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const task = await findTaskById(projectRoot, taskId);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const planDir = resolveAgentsPath(projectRoot, 'tasks', 'plans', taskId);
      await fs.mkdir(planDir, { recursive: true });

      const comments = await readYaml<PlanComment[]>(`${planDir}/comments.yaml`).catch((): PlanComment[] => []);
      const newComment: PlanComment = {
        id: `comment-${Date.now()}`,
        taskId,
        phase,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      comments.push(newComment);
      await writeYaml(`${planDir}/comments.yaml`, comments);

      broadcast(wss, { type: 'plan-comment-added', taskId, comment: newComment });

      res.status(201).json(newComment);
    } catch {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  return router;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function findTaskById(projectRoot: string, taskId: string): Promise<Task | undefined> {
  // Check backlog
  const backlog = await loadBacklog(projectRoot);
  const found = backlog.find((t) => t.id === taskId);
  if (found) return found;

  // Check in-progress, done, blocked
  for (const status of ['in-progress', 'done', 'blocked'] as const) {
    const dir = resolveAgentsPath(projectRoot, 'tasks', status);
    try {
      const taskPath = `${dir}/${taskId}.yaml`;
      const task = await readYaml<Task>(taskPath);
      return task;
    } catch { /* not in this directory */ }
  }

  return undefined;
}

async function updateTaskInBacklog(projectRoot: string, task: Task): Promise<void> {
  const backlogPath = resolveAgentsPath(projectRoot, 'tasks', 'backlog.yaml');
  const backlog = await loadBacklog(projectRoot);
  const idx = backlog.findIndex((t) => t.id === task.id);
  if (idx !== -1) {
    backlog[idx] = task;
    await writeYaml(backlogPath, backlog);
  }
}
