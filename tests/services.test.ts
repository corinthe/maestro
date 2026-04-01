/**
 * Integration tests for CRUD services.
 * Uses a temporary in-memory-like SQLite database.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// We need to set up a temp DB before importing services (they call getDb())
let tmpDir: string;

beforeAll(() => {
  // Create a temp .maestro directory and set it up
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-test-"));
  const maestroDir = path.join(tmpDir, ".maestro");
  fs.mkdirSync(maestroDir, { recursive: true });

  // Override working directory so getDb() finds our temp DB
  process.env.MAESTRO_PROJECT_ROOT = tmpDir;
  // We need to set cwd to tmpDir for getDb() to work
  const origCwd = process.cwd;
  process.cwd = () => tmpDir;

  // Force import of db to initialize with our temp path
  // The getDb() singleton will use process.cwd()
});

afterAll(() => {
  // Clean up
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("feature-service", () => {
  it("creates and lists features", async () => {
    const { createFeature, listFeatures, getFeature, deleteFeature } = await import("@/lib/services/feature-service");

    const feature = createFeature({ title: "Test Feature", description: "A test" });
    expect(feature.title).toBe("Test Feature");
    expect(feature.key).toMatch(/^MAE-\d+$/);
    expect(feature.status).toBe("backlog");

    const found = getFeature(feature.id);
    expect(found).toBeTruthy();
    expect(found!.title).toBe("Test Feature");

    const list = listFeatures();
    expect(list.length).toBeGreaterThanOrEqual(1);

    deleteFeature(feature.id);
    expect(getFeature(feature.id)).toBeUndefined();
  });

  it("updates features", async () => {
    const { createFeature, updateFeature } = await import("@/lib/services/feature-service");

    const feature = createFeature({ title: "Update Me" });
    const updated = updateFeature(feature.id, { status: "in_progress", title: "Updated" });
    expect(updated!.status).toBe("in_progress");
    expect(updated!.title).toBe("Updated");
  });

  it("generates sequential keys", async () => {
    const { createFeature } = await import("@/lib/services/feature-service");

    const f1 = createFeature({ title: "A" });
    const f2 = createFeature({ title: "B" });
    const num1 = parseInt(f1.key.replace("MAE-", ""));
    const num2 = parseInt(f2.key.replace("MAE-", ""));
    expect(num2).toBe(num1 + 1);
  });
});

describe("agent-service", () => {
  it("creates and lists agents", async () => {
    const { createAgent, listAgents, getAgent, deleteAgent } = await import("@/lib/services/agent-service");

    const agent = createAgent({ name: `test-agent-${Date.now()}`, config: { model: "sonnet" } });
    expect(agent.name).toContain("test-agent-");
    expect(agent.status).toBe("idle");

    const found = getAgent(agent.id);
    expect(found).toBeTruthy();
    expect(found!.name).toBe(agent.name);

    deleteAgent(agent.id);
    expect(getAgent(agent.id)).toBeUndefined();
  });

  it("sets agent status", async () => {
    const { createAgent, setAgentStatus, getAgent, deleteAgent } = await import("@/lib/services/agent-service");

    const agent = createAgent({ name: `status-agent-${Date.now()}`, config: {} });
    setAgentStatus(agent.id, "running");
    expect(getAgent(agent.id)!.status).toBe("running");

    setAgentStatus(agent.id, "idle");
    expect(getAgent(agent.id)!.status).toBe("idle");

    deleteAgent(agent.id);
  });
});

describe("run-service", () => {
  it("creates and retrieves runs", async () => {
    const { createRun, getRun, listRuns } = await import("@/lib/services/run-service");

    const run = createRun({ runType: "agent", prompt: "do something" });
    expect(run.status).toBe("queued");
    expect(run.prompt).toBe("do something");

    const found = getRun(run.id);
    expect(found).toBeTruthy();

    const list = listRuns();
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("updates run status", async () => {
    const { createRun, updateRun } = await import("@/lib/services/run-service");

    const run = createRun({ runType: "agent" });
    const updated = updateRun(run.id, { status: "running", startedAt: new Date().toISOString() });
    expect(updated!.status).toBe("running");
  });

  it("adds and retrieves run events", async () => {
    const { createRun, addRunEvent, getRunEvents } = await import("@/lib/services/run-service");

    const run = createRun({ runType: "agent" });
    addRunEvent({ runId: run.id, seq: 1, type: "system", subtype: "init", data: '{"test":true}' });
    addRunEvent({ runId: run.id, seq: 2, type: "assistant", subtype: "text", data: '{"text":"hello"}' });

    const events = getRunEvents(run.id);
    expect(events.length).toBe(2);
    expect(events[0].seq).toBe(1);
    expect(events[1].seq).toBe(2);
  });
});

describe("message-service", () => {
  it("creates and lists messages", async () => {
    const { createMessage, listMessages, markAsRead } = await import("@/lib/services/message-service");

    const msg = createMessage({ content: "Hello agent" });
    expect(msg.status).toBe("pending");

    const list = listMessages({ status: "pending" });
    expect(list.some((m) => m.id === msg.id)).toBe(true);

    const read = markAsRead(msg.id);
    expect(read!.status).toBe("read");
    expect(read!.readAt).toBeTruthy();
  });
});
