/**
 * WebSocket broadcast server.
 *
 * Since Next.js App Router doesn't support WebSocket natively,
 * we start a separate WS server on a dedicated port (default: 4201).
 * The client connects to this port for real-time events.
 */
import { WebSocketServer, WebSocket } from "ws";

let wss: WebSocketServer | null = null;

export function startWsServer(port: number = 4201): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ port, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("error", (err) => {
      console.error("[ws] client error:", err.message);
    });
  });

  console.log(`[ws] WebSocket server listening on ws://localhost:${port}/ws`);
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
