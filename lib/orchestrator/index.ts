/**
 * Orchestrator — manages the master Claude instance that coordinates agents.
 *
 * The orchestrator is a special Claude run (runType: "orchestrator") that uses
 * an internal MCP server to manage features, agents, and runs.
 */
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import { config, agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { executeRun, stopRun, getActiveRun } from "@/lib/claude/agent-runner";
import { broadcast } from "@/lib/ws/server";
import { buildOrchestratorPrompt } from "./prompt";

export type OrchestratorStatus = "idle" | "running" | "sleeping";

type OrchestratorState = {
  status: OrchestratorStatus;
  lastWakeAt: string | null;
  sessionId: string | null;
  currentRunId: string | null;
};

// --- Config helpers (stored in `config` table) ---

function getConfigValue(key: string): string | null {
  const db = getDb();
  const row = db.select().from(config).where(eq(config.key, key)).get();
  return row?.value ?? null;
}

function setConfigValue(key: string, value: string): void {
  const db = getDb();
  const existing = db.select().from(config).where(eq(config.key, key)).get();
  if (existing) {
    db.update(config).set({ value }).where(eq(config.key, key)).run();
  } else {
    db.insert(config).values({ key, value }).run();
  }
}

// --- Public API ---

export function getOrchestratorStatus(): OrchestratorState {
  const runId = getConfigValue("orchestrator.currentRunId");
  let status: OrchestratorStatus = "idle";
  if (runId && getActiveRun(runId)) {
    status = "running";
  } else if (getConfigValue("orchestrator.heartbeatEnabled") === "true") {
    status = "sleeping";
  }

  return {
    status,
    lastWakeAt: getConfigValue("orchestrator.lastWakeAt"),
    sessionId: getConfigValue("orchestrator.sessionId"),
    currentRunId: runId && getActiveRun(runId) ? runId : null,
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
 */
export async function wakeOrchestrator(
  reason: string = "heartbeat"
): Promise<{ runId: string; alreadyRunning: boolean }> {
  const currentRunId = getConfigValue("orchestrator.currentRunId");

  // Already running?
  if (currentRunId && getActiveRun(currentRunId)) {
    return { runId: currentRunId, alreadyRunning: true };
  }

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

  // Track state
  setConfigValue("orchestrator.currentRunId", runId);
  setConfigValue("orchestrator.lastWakeAt", new Date().toISOString());
  broadcast({
    type: "orchestrator.status",
    status: "running",
    runId,
    reason,
  });

  return { runId, alreadyRunning: false };
}

/**
 * Stop the orchestrator if it's running.
 */
export function stopOrchestrator(): boolean {
  const runId = getConfigValue("orchestrator.currentRunId");
  if (!runId) return false;
  const stopped = stopRun(runId);
  if (stopped) {
    broadcast({ type: "orchestrator.status", status: "idle" });
  }
  return stopped;
}

// --- Internal helpers ---

function ensureMcpConfig(projectRoot: string): string {
  const maestroDir = path.join(projectRoot, ".maestro");
  if (!fs.existsSync(maestroDir)) {
    fs.mkdirSync(maestroDir, { recursive: true });
  }

  const configPath = path.join(maestroDir, "mcp-config.json");
  const mcpServerPath = path.join(projectRoot, "lib", "mcp", "server.ts");

  const mcpConfig = {
    mcpServers: {
      maestro: {
        command: "npx",
        args: ["tsx", mcpServerPath],
        env: {
          MAESTRO_PORT: process.env.PORT ?? "4200",
        },
      },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
  return configPath;
}

function buildWakePrompt(reason: string): string {
  const now = new Date().toISOString();
  return `[Wake ${now}] Reason: ${reason}.
Check pending messages, review active runs, update feature statuses, and assign available work to idle agents. Report your actions concisely.`;
}

function getOrCreateOrchestratorAgentId(): string {
  const db = getDb();
  const existing = db
    .select()
    .from(agents)
    .where(eq(agents.name, "__orchestrator__"))
    .get();

  if (existing) return existing.id;

  const now = new Date().toISOString();
  const id = uuidv4();
  db.insert(agents)
    .values({
      id,
      name: "__orchestrator__",
      description: "Internal orchestrator agent",
      config: JSON.stringify({ model: "sonnet", maxTurnsPerRun: 30 }),
      status: "idle",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}
