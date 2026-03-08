import type { WebSocketServer } from 'ws';

export function broadcast(wss: WebSocketServer, data: Record<string, unknown>): void {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}
