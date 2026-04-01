/**
 * Startup recovery — detects orphan "running"/"queued" runs left by a previous
 * crash and marks them as failed. Also resets agents stuck in "running" state.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runs, agents } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("recovery");

export function recoverOrphanRuns(): { recoveredRuns: number; recoveredAgents: number } {
  const db = getDb();
  const now = new Date().toISOString();

  // Find runs stuck in running/queued state (no active process can own them after restart)
  const orphanRuns = db
    .select({ id: runs.id, agentId: runs.agentId, status: runs.status })
    .from(runs)
    .where(eq(runs.status, "running"))
    .all();

  const queuedRuns = db
    .select({ id: runs.id, agentId: runs.agentId, status: runs.status })
    .from(runs)
    .where(eq(runs.status, "queued"))
    .all();

  const allOrphans = [...orphanRuns, ...queuedRuns];

  for (const run of allOrphans) {
    db.update(runs)
      .set({ status: "failed", finishedAt: now })
      .where(eq(runs.id, run.id))
      .run();
    log.warn("marked orphan run as failed", { runId: run.id, previousStatus: run.status, agentId: run.agentId ?? undefined });
  }

  // Reset agents stuck in "running" state
  const stuckAgents = db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.status, "running"))
    .all();

  for (const agent of stuckAgents) {
    db.update(agents)
      .set({ status: "idle", updatedAt: now })
      .where(eq(agents.id, agent.id))
      .run();
    log.warn("reset stuck agent to idle", { agentId: agent.id, name: agent.name });
  }

  if (allOrphans.length > 0 || stuckAgents.length > 0) {
    log.info("startup recovery complete", {
      recoveredRuns: allOrphans.length,
      recoveredAgents: stuckAgents.length,
    });
  }

  return { recoveredRuns: allOrphans.length, recoveredAgents: stuckAgents.length };
}
