import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { writeYaml, readYaml } from '@maestro/core';
import { createAgentRoutes } from '../src/routes/agents.js';

let tmpDir: string;
let app: express.Express;
let server: ReturnType<typeof createServer>;
let wss: WebSocketServer;

function agentsPath(...segments: string[]): string {
  return path.join(tmpDir, '.ai-agents', ...segments);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-test-agents-'));
  await fs.mkdir(agentsPath('config'), { recursive: true });
  await fs.mkdir(agentsPath('agents'), { recursive: true });

  app = express();
  app.use(express.json());
  server = createServer(app);
  wss = new WebSocketServer({ server });
  app.use(createAgentRoutes(wss, tmpDir));
});

afterEach(async () => {
  wss.close();
  server.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/agents', () => {
  it('returns empty array when no agents configured', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns configured agents with idle state', async () => {
    await writeYaml(agentsPath('config', 'agents.yaml'), [
      { name: 'coder', role: 'developer', runner: 'claude-code' },
    ]);

    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('coder');
    expect(res.body[0].status).toBe('idle');
    expect(res.body[0].enabled).toBe(true);
  });
});

describe('POST /api/agents', () => {
  beforeEach(async () => {
    await writeYaml(agentsPath('config', 'agents.yaml'), []);
  });

  it('creates a new agent', async () => {
    const res = await request(app)
      .post('/api/agents')
      .send({ name: 'reviewer', role: 'code-review' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('reviewer');
    expect(res.body.role).toBe('code-review');
    expect(res.body.runner).toBe('claude-code');

    // Verify persisted
    const agents = await readYaml<Array<{ name: string }>>(agentsPath('config', 'agents.yaml'));
    expect(agents).toHaveLength(1);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/agents')
      .send({ role: 'developer' });

    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate agent name', async () => {
    await writeYaml(agentsPath('config', 'agents.yaml'), [
      { name: 'coder', role: 'developer' },
    ]);

    const res = await request(app)
      .post('/api/agents')
      .send({ name: 'coder', role: 'another-role' });

    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/agents/:name', () => {
  beforeEach(async () => {
    await writeYaml(agentsPath('config', 'agents.yaml'), [
      { name: 'coder', role: 'developer', runner: 'claude-code', enabled: true },
    ]);
  });

  it('updates agent fields', async () => {
    const res = await request(app)
      .patch('/api/agents/coder')
      .send({ role: 'senior-developer' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('senior-developer');
  });

  it('disables an agent', async () => {
    const res = await request(app)
      .patch('/api/agents/coder')
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await request(app)
      .patch('/api/agents/unknown')
      .send({ role: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/agents/:name', () => {
  beforeEach(async () => {
    await writeYaml(agentsPath('config', 'agents.yaml'), [
      { name: 'coder', role: 'developer' },
    ]);
  });

  it('deletes an agent', async () => {
    const res = await request(app).delete('/api/agents/coder');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe('coder');

    const agents = await readYaml<Array<{ name: string }>>(agentsPath('config', 'agents.yaml'));
    expect(agents).toHaveLength(0);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await request(app).delete('/api/agents/unknown');
    expect(res.status).toBe(404);
  });
});
