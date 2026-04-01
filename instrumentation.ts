/**
 * Next.js instrumentation hook — runs once when the server starts.
 * We use it to recover orphan runs, start the WebSocket server,
 * the heartbeat scheduler, and the run_events purge scheduler.
 */
export async function register() {
  // Only run on the server side (not during build or in edge runtime)
  if (typeof window === "undefined" && process.env.NEXT_RUNTIME === "nodejs") {
    // Recover orphan runs/agents left by a previous crash
    const { recoverOrphanRuns } = await import("@/lib/startup-recovery");
    recoverOrphanRuns();

    const { startWsServer } = await import("@/lib/ws/server");
    const wsPort = parseInt(process.env.WS_PORT ?? "4201", 10);
    startWsServer(wsPort);

    // Start the heartbeat scheduler (only wakes if enabled in config)
    const { startHeartbeat } = await import("@/lib/orchestrator/heartbeat");
    startHeartbeat();

    // Start the run_events purge scheduler (every hour, deletes events older than 24h)
    const { startPurgeScheduler } = await import("@/lib/purge");
    startPurgeScheduler();
  }
}
