import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { createStatusRoutes } from '../src/routes/status.js';

let app: express.Express;
let server: ReturnType<typeof createServer>;
let wss: WebSocketServer;
let isPaused: () => boolean;

beforeEach(() => {
  app = express();
  app.use(express.json());
  server = createServer(app);
  wss = new WebSocketServer({ server });
  const routes = createStatusRoutes(wss, '/tmp/test-project');
  app.use(routes.router);
  isPaused = routes.isPaused;
});

afterEach(() => {
  wss.close();
  server.close();
});

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.projectRoot).toBe('/tmp/test-project');
  });
});

describe('GET /api/status', () => {
  it('returns initial unpaused state', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.paused).toBe(false);
  });
});

describe('POST /api/pause', () => {
  it('pauses the orchestrator', async () => {
    const res = await request(app).post('/api/pause');
    expect(res.status).toBe(200);
    expect(res.body.paused).toBe(true);
    expect(isPaused()).toBe(true);
  });
});

describe('POST /api/resume', () => {
  it('resumes the orchestrator after pause', async () => {
    await request(app).post('/api/pause');
    expect(isPaused()).toBe(true);

    const res = await request(app).post('/api/resume');
    expect(res.status).toBe(200);
    expect(res.body.paused).toBe(false);
    expect(isPaused()).toBe(false);
  });
});
