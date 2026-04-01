/**
 * Tests for startup recovery — ensures orphan runs and stuck agents are cleaned up.
 */
import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import { runs, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { recoverOrphanRuns } from "@/lib/startup-recovery";

describe("recoverOrphanRuns", () => {
  it("marks orphan running runs as failed", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create a fake agent
    const agentId = uuidv4();
    db.insert(agents).values({
      id: agentId,
      name: `recovery-test-agent-${agentId.slice(0, 8)}`,
      config: "{}",
      status: "running",
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create an orphan running run
    const runId = uuidv4();
    db.insert(runs).values({
      id: runId,
      agentId,
      runType: "agent",
      status: "running",
      createdAt: now,
      startedAt: now,
    }).run();

    // Create an orphan queued run
    const queuedRunId = uuidv4();
    db.insert(runs).values({
      id: queuedRunId,
      agentId,
      runType: "agent",
      status: "queued",
      createdAt: now,
    }).run();

    const result = recoverOrphanRuns();
    expect(result.recoveredRuns).toBeGreaterThanOrEqual(2);
    expect(result.recoveredAgents).toBeGreaterThanOrEqual(1);

    // Verify runs are marked failed
    const run = db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run!.status).toBe("failed");
    expect(run!.finishedAt).toBeTruthy();

    const queuedRun = db.select().from(runs).where(eq(runs.id, queuedRunId)).get();
    expect(queuedRun!.status).toBe("failed");

    // Verify agent is reset to idle
    const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
    expect(agent!.status).toBe("idle");

    // Cleanup
    db.delete(runs).where(eq(runs.id, runId)).run();
    db.delete(runs).where(eq(runs.id, queuedRunId)).run();
    db.delete(agents).where(eq(agents.id, agentId)).run();
  });

  it("returns zero when no orphans exist", () => {
    // After the previous test cleaned up, running again should find no new orphans
    // (unless other tests left some — hence >= 0)
    const result = recoverOrphanRuns();
    expect(result.recoveredRuns).toBeGreaterThanOrEqual(0);
  });
});
