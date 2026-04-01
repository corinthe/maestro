/**
 * Orchestrator — manages the master Claude instance that coordinates agents.
 *
 * The orchestrator is a special Claude run (runType: "orchestrator") that uses
 * an internal MCP server to manage features, agents, and runs.
 */
import path from "node:path";
import fs from "node:fs";
import { getDb } from "@/lib/db";
import { config, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createAgent } from "@/lib/services/agent-service";
import { executeRun, stopRun, getActiveRun } from "@/lib/claude/agent-runner";
import { broadcast } from "@/lib/ws/server";
import { ORCHESTRATOR_AGENT_NAME } from "@/lib/types";
import { buildOrchestratorPrompt } from "./prompt";
import { createLogger } from "@/lib/logger";

const log = createLogger("orchestrator");

export type OrchestratorStatus = "idle" | "running" | "sleeping";

type OrchestratorState = {
  status: OrchestratorStatus;
  lastWakeAt: string | null;
  sessionId: string | null;
  currentRunId: string | null;
};

// Cached orchestrator agent ID (populated on first call)
let cachedOrchestratorAgentId: string | null = null;

// Mutex to prevent concurrent wakeups
let wakeInProgress = false;

// --- Config helpers (stored in `config` table) ---

function getConfigValue(key: string): string | null {
  const db = getDb();
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value ?? null;
}

function setConfigValue(key: string, value: string): void {
  const db = getDb();
  // Atomic upsert — avoids TOCTOU race from SELECT + INSERT/UPDATE
  db.insert(config)
    .values({ key, value })
    .onConflictDoUpdate({ target: config.key, set: { value } })
    .run();
}

// --- Public API ---

export function getOrchestratorStatus(): OrchestratorState {
  const runId = getConfigValue("orchestrator.currentRunId");
  const active = runId ? getActiveRun(runId) : undefined;
  let status: OrchestratorStatus = "idle";
  if (active) {
    status = "running";
  } else if (getConfigValue("orchestrator.heartbeatEnabled") === "true") {
    status = "sleeping";
  }

  return {
    status,
    lastWakeAt: getConfigValue("orchestrator.lastWakeAt"),
    sessionId: getConfigValue("orchestrator.sessionId"),
    currentRunId: active ? runId : null,
  };
}

export function getHeartbeatConfig(): {
  enabled: boolean;
  intervalSec: number;
} {
  return {
    enabled: getConfigValue("orchestrator.heartbeatEnabled") === "true",
    intervalSec: parseInt(
      getConfigValue("orchestrator.heartbeatIntervalSec") ?? "300",
      10
    ),
  };
}

export function setHeartbeatConfig(opts: {
  enabled?: boolean;
  intervalSec?: number;
}): void {
  if (opts.enabled !== undefined) {
    setConfigValue(
      "orchestrator.heartbeatEnabled",
      opts.enabled ? "true" : "false"
    );
  }
  if (opts.intervalSec !== undefined) {
    setConfigValue(
      "orchestrator.heartbeatIntervalSec",
      String(opts.intervalSec)
    );
  }
}

/**
 * Wake the orchestrator — starts a new orchestrator run.
 * If already running, returns the existing run ID.
 * Uses an in-memory mutex to prevent concurrent wakeups.
 */
export async function wakeOrchestrator(
  reason: string = "heartbeat"
): Promise<{ runId: string; alreadyRunning: boolean }> {
  const currentRunId = getConfigValue("orchestrator.currentRunId");

  if (currentRunId && getActiveRun(currentRunId)) {
    log.debug("orchestrator already running", { runId: currentRunId, reason });
    return { runId: currentRunId, alreadyRunning: true };
  }

  // Mutex: prevent concurrent wakeup attempts
  if (wakeInProgress) {
    log.warn("wakeup blocked by mutex", { reason });
    // Return a sentinel — caller should treat this like alreadyRunning
    const fallbackId = currentRunId ?? "pending";
    return { runId: fallbackId, alreadyRunning: true };
  }

  wakeInProgress = true;
  try {
    log.info("waking orchestrator", { reason });

    const projectRoot = process.cwd();
    const mcpConfigPath = ensureMcpConfig(projectRoot);
    const systemPrompt = buildOrchestratorPrompt(projectRoot);
    const prompt = buildWakePrompt(reason);
    const existingSessionId = getConfigValue("orchestrator.sessionId");

    const runId = await executeRun({
      agentId: getOrCreateOrchestratorAgentId(),
      prompt,
      runType: "orchestrator",
      config: {
        model: getConfigValue("orchestrator.model") ?? "sonnet",
        maxTurnsPerRun: 30,
        skipPermissions: true,
      },
      cwd: projectRoot,
      sessionId: existingSessionId ?? undefined,
      timeoutSec: 300,
      mcpConfigPath,
      systemPrompt,
    });

    setConfigValue("orchestrator.currentRunId", runId);
    setConfigValue("orchestrator.lastWakeAt", new Date().toISOString());
    broadcast({
      type: "orchestrator.status",
      status: "running",
      runId,
      reason,
    });

    log.info("orchestrator started", { runId, reason });
    return { runId, alreadyRunning: false };
  } catch (err) {
    log.error("failed to wake orchestrator", { reason, error: String(err) });
    throw err;
  } finally {
    wakeInProgress = false;
  }
}

/**
 * Stop the orchestrator if it's running.
 */
export function stopOrchestrator(): boolean {
  const runId = getConfigValue("orchestrator.currentRunId");
  if (!runId) return false;
  const stopped = stopRun(runId);
  if (stopped) {
    log.info("orchestrator stopped", { runId });
    broadcast({ type: "orchestrator.status", status: "idle" });
  }
  return stopped;
}

// --- Internal helpers ---

/** Last written MCP config content (avoids redundant disk writes). */
let lastMcpConfigContent: string | null = null;

function ensureMcpConfig(projectRoot: string): string {
  const maestroDir = path.join(projectRoot, ".maestro");
  fs.mkdirSync(maestroDir, { recursive: true });

  const configPath = path.join(maestroDir, "mcp-config.json");
  const mcpServerPath = path.join(projectRoot, "lib", "mcp", "server.ts");

  const mcpConfig = {
    mcpServers: {
      maestro: {
        command: "npx",
        args: ["tsx", mcpServerPath],
        env: {
          MAESTRO_PORT: process.env.MAESTRO_PORT ?? "4200",
        },
      },
    },
  };

  const content = JSON.stringify(mcpConfig, null, 2);
  if (content !== lastMcpConfigContent) {
    fs.writeFileSync(configPath, content);
    lastMcpConfigContent = content;
  }

  return configPath;
}

function buildWakePrompt(reason: string): string {
  const now = new Date().toISOString();
  return `[Wake ${now}] Reason: ${reason}.
Check pending messages, review active runs, update feature statuses, and assign available work to idle agents. Report your actions concisely.`;
}

function getOrCreateOrchestratorAgentId(): string {
  if (cachedOrchestratorAgentId) return cachedOrchestratorAgentId;

  const db = getDb();
  const existing = db
    .select()
    .from(agents)
    .where(eq(agents.name, ORCHESTRATOR_AGENT_NAME))
    .get();

  if (existing) {
    cachedOrchestratorAgentId = existing.id;
    return existing.id;
  }

  const created = createAgent({
    name: ORCHESTRATOR_AGENT_NAME,
    description: "Internal orchestrator agent",
    config: { model: "sonnet", maxTurnsPerRun: 30 },
  });

  cachedOrchestratorAgentId = created.id;
  return created.id;
}
