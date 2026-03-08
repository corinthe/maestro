import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { writeYaml, readYaml } from '@maestro/core';
import { createTaskRoutes } from '../src/routes/tasks.js';

let tmpDir: string;
let app: express.Express;
let server: ReturnType<typeof createServer>;
let wss: WebSocketServer;

function agentsPath(...segments: string[]): string {
  return path.join(tmpDir, '.ai-agents', ...segments);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-test-tasks-'));
  await fs.mkdir(agentsPath('tasks'), { recursive: true });
  await fs.mkdir(agentsPath('signals'), { recursive: true });

  app = express();
  app.use(express.json());
  server = createServer(app);
  wss = new WebSocketServer({ server });
  app.use(createTaskRoutes(wss, tmpDir));
});

afterEach(async () => {
  wss.close();
  server.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/tasks', () => {
  it('returns empty array when no tasks exist', async () => {
    // Write an empty backlog file
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), []);

    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns backlog tasks', async () => {
    const tasks = [
      { id: 'task-1', title: 'Test', description: 'Desc', status: 'backlog' },
    ];
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), tasks);

    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('task-1');
    expect(res.body[0].status).toBe('backlog');
  });

  it('returns tasks from all status directories', async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-1', title: 'Backlog', description: 'D', status: 'backlog' },
    ]);

    await fs.mkdir(agentsPath('tasks', 'in-progress'), { recursive: true });
    await writeYaml(agentsPath('tasks', 'in-progress', 'task-2.yaml'), {
      id: 'task-2', title: 'In Progress', description: 'D', status: 'in-progress',
    });

    await fs.mkdir(agentsPath('tasks', 'done'), { recursive: true });
    await writeYaml(agentsPath('tasks', 'done', 'task-3.yaml'), {
      id: 'task-3', title: 'Done', description: 'D', status: 'done',
    });

    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    const ids = res.body.map((t: { id: string }) => t.id);
    expect(ids).toContain('task-1');
    expect(ids).toContain('task-2');
    expect(ids).toContain('task-3');
  });
});

describe('POST /api/tasks', () => {
  beforeEach(async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), []);
  });

  it('creates a task in backlog', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'New Task', description: 'A new task' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Task');
    expect(res.body.status).toBe('backlog');
    expect(res.body.id).toMatch(/^task-\d+$/);

    // Verify task was persisted to backlog.yaml
    const backlog = await readYaml<Array<{ id: string }>>(agentsPath('tasks', 'backlog.yaml'));
    expect(backlog).toHaveLength(1);
    expect(backlog[0].id).toBe(res.body.id);
  });

  it('emits a wake signal after creation', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'Wake Test', description: 'Should trigger wake' });

    // Verify the wake signal file was created
    const signalFiles = await fs.readdir(agentsPath('signals'));
    const wakeSignal = signalFiles.find((f) => f.includes('wake'));
    expect(wakeSignal).toBeDefined();

    const signal = await readYaml<{ type: string; summary: string }>(
      agentsPath('signals', wakeSignal!)
    );
    expect(signal.type).toBe('wake');
    expect(signal.summary).toContain('New task created');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ description: 'No title' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title and description are required');
  });

  it('returns 400 when description is missing', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'No desc' });

    expect(res.status).toBe(400);
  });

  it('preserves optional fields', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Full Task',
        description: 'With all fields',
        acceptanceCriteria: ['criterion 1'],
        dependsOn: ['task-other'],
        filesLocked: ['src/index.ts'],
      });

    expect(res.status).toBe(201);
    expect(res.body.acceptanceCriteria).toEqual(['criterion 1']);
    expect(res.body.dependsOn).toEqual(['task-other']);
    expect(res.body.filesLocked).toEqual(['src/index.ts']);
  });

  it('appends to existing backlog', async () => {
    const existing = [
      { id: 'task-existing', title: 'Existing', description: 'D', status: 'backlog' },
    ];
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), existing);

    await request(app)
      .post('/api/tasks')
      .send({ title: 'Second', description: 'Another' });

    const backlog = await readYaml<Array<{ id: string }>>(agentsPath('tasks', 'backlog.yaml'));
    expect(backlog).toHaveLength(2);
    expect(backlog[0].id).toBe('task-existing');
  });
});

describe('PATCH /api/tasks/:id/status', () => {
  beforeEach(async () => {
    await writeYaml(agentsPath('tasks', 'backlog.yaml'), [
      { id: 'task-move', title: 'Movable', description: 'D', status: 'backlog' },
    ]);
  });

  it('moves a backlog task to done', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-move/status')
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');

    // Verify removed from backlog
    const backlog = await readYaml<Array<{ id: string }>>(agentsPath('tasks', 'backlog.yaml'));
    expect(backlog).toHaveLength(0);

    // Verify written to done directory
    const doneTask = await readYaml<{ id: string; status: string }>(
      agentsPath('tasks', 'done', 'task-move.yaml')
    );
    expect(doneTask.status).toBe('done');
  });

  it('returns 404 for unknown task', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-unknown/status')
      .send({ status: 'done' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-move/status')
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('moves a done task back to backlog', async () => {
    // First move to done
    await request(app)
      .patch('/api/tasks/task-move/status')
      .send({ status: 'done' });

    // Then move back to backlog
    const res = await request(app)
      .patch('/api/tasks/task-move/status')
      .send({ status: 'backlog' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('backlog');

    const backlog = await readYaml<Array<{ id: string }>>(agentsPath('tasks', 'backlog.yaml'));
    expect(backlog).toHaveLength(1);
    expect(backlog[0].id).toBe('task-move');
  });
});
