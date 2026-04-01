/**
 * WebSocket broadcast server.
 *
 * Since Next.js App Router doesn't support WebSocket natively,
 * we start a separate WS server on a dedicated port (default: 4201).
 * The client connects to this port for real-time events.
 */
import { WebSocketServer, WebSocket } from "ws";
import { createLogger } from "@/lib/logger";

const log = createLogger("ws");

let wss: WebSocketServer | null = null;

export function startWsServer(port: number = 4201): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ port, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("error", (err) => {
      log.error("client error", { error: err.message });
    });
  });

  log.info("WebSocket server listening", { port, path: "/ws" });
  return wss;
}

export function stopWsServer(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
}

export function broadcast(data: unknown): void {
  if (!wss) return;
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
