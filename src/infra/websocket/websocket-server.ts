import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { EventBus, TaskEvent } from "../../domain/orchestration/events.js";
import { logger } from "../../shared/logger.js";

export class MaestroWebSocketServer {
  private wss: WebSocketServer;

  constructor(server: Server, eventBus: EventBus) {
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws) => {
      logger.info({ clients: this.wss.clients.size }, "Client WebSocket connecte");

      ws.on("close", () => {
        logger.info({ clients: this.wss.clients.size }, "Client WebSocket deconnecte");
      });
    });

    eventBus.onAll((event: TaskEvent) => {
      this.broadcast(event);
    });

    logger.info("Serveur WebSocket initialise");
  }

  private broadcast(event: TaskEvent): void {
    const message = JSON.stringify({
      type: event.type,
      taskId: event.taskId,
      timestamp: event.timestamp.toISOString(),
      data: event.data,
    });

    let sent = 0;
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    }

    logger.debug({ type: event.type, taskId: event.taskId, clients: sent }, "Evenement broadcast via WebSocket");
  }

  getClientCount(): number {
    return this.wss.clients.size;
  }

  close(): void {
    this.wss.close();
  }
}
