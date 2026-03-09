import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { writeYaml, readYaml, writeMarkdown } from '@maestro/core';
import { createTaskPlanRoutes } from '../src/routes/plans.js';
import { createTaskRoutes } from '../src/routes/tasks.js';

let tmpDir: string;
let app: express.Express;
let server: ReturnType<typeof createServer>;
let wss: WebSocketServer;

function agentsPath(...segments: string[]): string {
  return path.join(tmpDir, '.ai-agents', ...segments);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-test-plans-'));
  await fs.mkdir(agentsPath('tasks'), { recursive: true });
  await fs.mkdir(agentsPath('signals'), { recursive: true });

  app = express();
  app.use(express.json());
  server = createServer(app);
  wss = new WebSocketServer({ server });
  app.use(createTaskRoutes(wss, tmpDir));
  app.use(createTaskPlanRoutes(wss, tmpDir));
});

afterEach(async () => {
  wss.close();
  server.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/tasks/:taskId/plan', () => {
  it('returns empty plan state for new task', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-planning', functionalPlanVersion: 1 },
    ]);

    const res = await request(app).get('/api/tasks/task-1/plan');
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBe('task-1');
    expect(res.body.planningPhase).toBe('functional-planning');
    expect(res.body.functionalPlan).toBe('');
    expect(res.body.technicalPlan).toBe('');
    expect(res.body.comments).toEqual([]);
  });

  it('returns plan content when plan files exist', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review', functionalPlanVersion: 1 },
    ]);

    await fs.mkdir(agentsPath('tasks', 'plans', 'task-1'), { recursive: true });
    await writeMarkdown(agentsPath('tasks', 'plans', 'task-1', 'functional-v1.md'), '# Functional Plan\nUser stories here.');

    const res = await request(app).get('/api/tasks/task-1/plan');
    expect(res.status).toBe(200);
    expect(res.body.functionalPlan).toContain('Functional Plan');
  });

  it('returns 404 for unknown task', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), []);
    const res = await request(app).get('/api/tasks/task-unknown/plan');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tasks/:taskId/plan/approve', () => {
  it('advances from functional-review to technical-planning', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review', functionalPlanVersion: 1 },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/approve')
      .send({ phase: 'functional' });

    expect(res.status).toBe(200);
    expect(res.body.planningPhase).toBe('technical-planning');

    // Verify signal emitted
    const signalFiles = await fs.readdir(agentsPath('signals'));
    const planSignal = signalFiles.find((f) => f.includes('plan-approved'));
    expect(planSignal).toBeDefined();
  });

  it('advances from technical-review to approved', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'technical-review', technicalPlanVersion: 1 },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/approve')
      .send({ phase: 'technical' });

    expect(res.status).toBe(200);
    expect(res.body.planningPhase).toBe('approved');
  });

  it('rejects if task not in review phase', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-planning' },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/approve')
      .send({ phase: 'functional' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not in functional-review phase');
  });

  it('rejects invalid phase', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review' },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/approve')
      .send({ phase: 'invalid' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks/:taskId/plan/request-changes', () => {
  it('saves comment and resets to planning phase', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review', functionalPlanVersion: 1 },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/request-changes')
      .send({ phase: 'functional', comment: 'Please add more detail' });

    expect(res.status).toBe(200);
    expect(res.body.planningPhase).toBe('functional-planning');
    expect(res.body.comment.content).toBe('Please add more detail');

    // Verify comment saved
    const comments = await readYaml<Array<{ content: string }>>(
      agentsPath('tasks', 'plans', 'task-1', 'comments.yaml')
    );
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe('Please add more detail');

    // Verify version incremented
    const backlog = await readYaml<Array<{ functionalPlanVersion: number }>>(
      agentsPath('tasks', 'backlog.yaml')
    );
    expect(backlog[0].functionalPlanVersion).toBe(2);

    // Verify signal emitted
    const signalFiles = await fs.readdir(agentsPath('signals'));
    const planSignal = signalFiles.find((f) => f.includes('plan-revision-requested'));
    expect(planSignal).toBeDefined();
  });

  it('rejects if not in review phase', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-planning' },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/request-changes')
      .send({ phase: 'functional', comment: 'Feedback' });

    expect(res.status).toBe(400);
  });

  it('rejects if comment is missing', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review' },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/request-changes')
      .send({ phase: 'functional' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('comment is required');
  });
});

describe('POST /api/tasks/:taskId/plan/comments', () => {
  it('adds a comment', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review' },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/comments')
      .send({ phase: 'functional', content: 'A comment' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('A comment');
    expect(res.body.phase).toBe('functional');
    expect(res.body.id).toMatch(/^comment-/);
  });

  it('returns 404 for unknown task', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), []);
    const res = await request(app)
      .post('/api/tasks/task-unknown/plan/comments')
      .send({ phase: 'functional', content: 'Comment' });

    expect(res.status).toBe(404);
  });

  it('rejects if content is missing', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog', planningPhase: 'functional-review' },
    ]);

    const res = await request(app)
      .post('/api/tasks/task-1/plan/comments')
      .send({ phase: 'functional' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks with enablePlanning', () => {
  beforeEach(async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), []);
  });

  it('creates task with planningPhase when enablePlanning is true', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Planned Task', description: 'With planning', enablePlanning: true });

    expect(res.status).toBe(201);
    expect(res.body.planningPhase).toBe('functional-planning');
    expect(res.body.functionalPlanVersion).toBe(1);
  });

  it('creates task without planningPhase when enablePlanning is false', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Direct Task', description: 'No planning', enablePlanning: false });

    expect(res.status).toBe(201);
    expect(res.body.planningPhase).toBeUndefined();
  });

  it('creates task without planningPhase when enablePlanning is omitted', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Default Task', description: 'Default behavior' });

    expect(res.status).toBe(201);
    expect(res.body.planningPhase).toBeUndefined();
  });
});
