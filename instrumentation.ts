/**
 * Next.js instrumentation hook — runs once when the server starts.
 * We use it to start the WebSocket server and heartbeat scheduler.
 */
export async function register() {
  // Only run on the server side (not during build or in edge runtime)
  if (typeof window === "undefined" && process.env.NEXT_RUNTIME === "nodejs") {
    const { startWsServer } = await import("@/lib/ws/server");
    const wsPort = parseInt(process.env.WS_PORT ?? "4201", 10);
    startWsServer(wsPort);

    // Start the heartbeat scheduler (only wakes if enabled in config)
    const { startHeartbeat } = await import("@/lib/orchestrator/heartbeat");
    startHeartbeat();
  }
}
