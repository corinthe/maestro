/**
 * Heartbeat scheduler — periodically wakes the orchestrator to check on progress.
 */
import { wakeOrchestrator, getHeartbeatConfig } from "./index";

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

  console.log(
    `[heartbeat] Starting heartbeat every ${config.intervalSec}s`
  );

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
        console.log(`[heartbeat] Woke orchestrator, runId=${result.runId}`);
      }
    } catch (err) {
      console.error("[heartbeat] Failed to wake orchestrator:", err);
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
    console.log("[heartbeat] Stopped heartbeat");
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
