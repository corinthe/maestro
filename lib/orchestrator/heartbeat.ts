/**
 * Heartbeat scheduler — periodically wakes the orchestrator to check on progress.
 */
import { wakeOrchestrator, getHeartbeatConfig } from "./index";
import { createLogger } from "@/lib/logger";

const log = createLogger("heartbeat");

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let currentIntervalSec = 0;

/**
 * Start the heartbeat scheduler. Safe to call multiple times — restarts if config changed.
 */
export function startHeartbeat(): void {
  const config = getHeartbeatConfig();
  if (!config.enabled) {
    stopHeartbeat();
    return;
  }

  // Already running at the same interval?
  if (intervalHandle && currentIntervalSec === config.intervalSec) {
    return;
  }

  // Restart with new interval
  stopHeartbeat();
  currentIntervalSec = config.intervalSec;

  log.info("starting heartbeat", { intervalSec: config.intervalSec });

  intervalHandle = setInterval(async () => {
    // Re-check config on each tick (user may have disabled)
    const latest = getHeartbeatConfig();
    if (!latest.enabled) {
      stopHeartbeat();
      return;
    }

    try {
      const result = await wakeOrchestrator("heartbeat");
      if (!result.alreadyRunning) {
        log.info("woke orchestrator", { runId: result.runId });
      } else {
        log.debug("heartbeat tick skipped, already running");
      }
    } catch (err) {
      log.error("failed to wake orchestrator", { error: String(err) });
    }
  }, config.intervalSec * 1000);
}

/**
 * Stop the heartbeat scheduler.
 */
export function stopHeartbeat(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    currentIntervalSec = 0;
    log.info("heartbeat stopped");
  }
}

/**
 * Restart the heartbeat (e.g., after config change).
 */
export function restartHeartbeat(): void {
  stopHeartbeat();
  startHeartbeat();
}

export function isHeartbeatRunning(): boolean {
  return intervalHandle !== null;
}
