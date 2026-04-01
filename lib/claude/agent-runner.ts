/**
 * Agent runner — orchestrates a full run: create DB record, spawn Claude,
 * parse events, save to DB, broadcast via WebSocket, handle completion.
 */
import { spawnClaude, type ClaudeProcess } from "./adapter";
import { type StreamEvent } from "./parser";
import { type AgentConfig } from "./args-builder";
import * as runService from "@/lib/services/run-service";
import { setAgentStatus } from "@/lib/services/agent-service";
import { broadcast } from "@/lib/ws/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-runner");

export type RunRequest = {
  agentId: string;
  featureId?: string;
  prompt: string;
  config: AgentConfig;
  cwd: string;
  sessionId?: string;
  env?: Record<string, string>;
  timeoutSec?: number;
  graceSec?: number;
  mcpConfigPath?: string;
  systemPrompt?: string;
  runType?: string;
};

// Track active processes so we can stop them
const activeRuns = new Map<string, ClaudeProcess>();

export function getActiveRun(runId: string): ClaudeProcess | undefined {
  return activeRuns.get(runId);
}

export function listActiveRunIds(): string[] {
  return Array.from(activeRuns.keys());
}

export async function executeRun(req: RunRequest): Promise<string> {
  log.info("run starting", { agentId: req.agentId, featureId: req.featureId, runType: req.runType ?? "agent" });

  // 1. Create run record in DB
  const run = runService.createRun({
    agentId: req.agentId,
    featureId: req.featureId,
    runType: req.runType ?? "agent",
    prompt: req.prompt,
    model: req.config.model,
  });

  const runId = run.id;
  let seq = 0;

  // 2. Mark run as running
  runService.updateRun(runId, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  // 3. Mark agent as running
  setAgentStatus(req.agentId, "running");
  broadcast({ type: "agent.status", agentId: req.agentId, status: "running" });
  broadcast({ type: "run.status", runId, status: "running" });

  // 4. Setup timeout
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  // 5. Spawn Claude CLI
  const proc = spawnClaude(
    req.config,
    {
      prompt: req.prompt,
      sessionId: req.sessionId,
      mcpConfigPath: req.mcpConfigPath,
      systemPrompt: req.systemPrompt,
    },
    req.cwd,
    req.env,
    {
      onEvent(event: StreamEvent) {
        seq++;

        // Capture session ID from init event
        if (event.type === "system" && event.subtype === "init" && event.sessionId) {
          runService.updateRun(runId, { sessionId: event.sessionId });
        }

        // Capture result metrics
        if (event.type === "result") {
          runService.updateRun(runId, {
            summary: event.summary ?? undefined,
            costUsd: event.costUsd,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            cachedTokens: event.cachedTokens,
          });
        }

        // Save event to DB
        runService.addRunEvent({
          runId,
          seq,
          type: event.type,
          subtype: event.subtype,
          data: event.raw,
        });

        // Broadcast via WebSocket
        broadcast({ type: "run.event", runId, event });
      },

      onError(error: string) {
        log.debug("stderr output", { runId, error: error.trim() });
        seq++;
        runService.addRunEvent({
          runId,
          seq,
          type: "system",
          subtype: "stderr",
          data: JSON.stringify({ stderr: error }),
        });
      },

      onExit(code: number | null, signal: NodeJS.Signals | null) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const stopTimer = stopTimers.get(runId);
        if (stopTimer) { clearTimeout(stopTimer); stopTimers.delete(runId); }
        activeRuns.delete(runId);

        const now = new Date().toISOString();
        let status: string;

        if (timedOut) {
          status = "timed_out";
        } else if (signal === "SIGTERM" || signal === "SIGKILL") {
          status = "stopped";
        } else if (code === 0) {
          status = "succeeded";
        } else {
          status = "failed";
        }

        runService.updateRun(runId, {
          status,
          exitCode: code ?? undefined,
          finishedAt: now,
        });

        log.info("run finished", { runId, agentId: req.agentId, status, exitCode: code, signal });

        // Mark agent as idle
        setAgentStatus(req.agentId, "idle");
        broadcast({ type: "agent.status", agentId: req.agentId, status: "idle" });
        broadcast({ type: "run.status", runId, status });
      },
    }
  );

  // Track PID
  runService.updateRun(runId, { pid: proc.pid });
  activeRuns.set(runId, proc);

  // 6. Setup timeout if configured
  if (req.timeoutSec && req.timeoutSec > 0) {
    const graceSec = req.graceSec ?? 30;
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      // Force kill after grace period
      setTimeout(() => {
        proc.kill("SIGKILL");
      }, graceSec * 1000);
    }, req.timeoutSec * 1000);
  }

  return runId;
}

// Pending force-kill timers for graceful shutdown
const stopTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function stopRun(runId: string): boolean {
  const proc = activeRuns.get(runId);
  if (!proc) return false;
  proc.kill("SIGTERM");
  // Force kill after 30s grace
  const timer = setTimeout(() => {
    stopTimers.delete(runId);
    if (activeRuns.has(runId)) {
      proc.kill("SIGKILL");
    }
  }, 30_000);
  stopTimers.set(runId, timer);
  return true;
}
