import { describe, it, expect, afterEach } from "vitest";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import { MaestroWebSocketServer } from "./websocket-server.js";
import { InMemoryEventBus } from "../events/in-memory-event-bus.js";
import type { TaskEvent } from "../../domain/orchestration/events.js";

function waitForMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.once("message", (data) => resolve(data.toString()));
  });
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
    } else {
      ws.once("open", () => resolve());
    }
  });
}

describe("MaestroWebSocketServer", () => {
  let httpServer: ReturnType<typeof createServer>;
  let wsServer: MaestroWebSocketServer;
  let clients: WebSocket[];

  afterEach(async () => {
    for (const client of clients ?? []) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    clients = [];
    wsServer?.close();
    await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  });

  async function setup(): Promise<{ eventBus: InMemoryEventBus; connectClient: () => Promise<WebSocket> }> {
    const eventBus = new InMemoryEventBus();
    httpServer = createServer();
    wsServer = new MaestroWebSocketServer(httpServer, eventBus);
    clients = [];

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as { port: number }).port;

    const connectClient = async (): Promise<WebSocket> => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      clients.push(ws);
      await waitForOpen(ws);
      return ws;
    };

    return { eventBus, connectClient };
  }

  it("doit envoyer un evenement a un client connecte", async () => {
    const { eventBus, connectClient } = await setup();
    const client = await connectClient();

    const messagePromise = waitForMessage(client);

    const event: TaskEvent = {
      type: "task:status_changed",
      taskId: "task-1",
      timestamp: new Date("2026-01-01T00:00:00Z"),
      data: { from: "inbox", to: "analyzing" },
    };
    eventBus.emit(event);

    const received = JSON.parse(await messagePromise);
    expect(received.type).toBe("task:status_changed");
    expect(received.taskId).toBe("task-1");
    expect(received.data.from).toBe("inbox");
    expect(received.data.to).toBe("analyzing");
  });

  it("doit envoyer un evenement a plusieurs clients", async () => {
    const { eventBus, connectClient } = await setup();
    const client1 = await connectClient();
    const client2 = await connectClient();

    const promise1 = waitForMessage(client1);
    const promise2 = waitForMessage(client2);

    eventBus.emit({
      type: "task:plan_ready",
      taskId: "task-2",
      timestamp: new Date(),
      data: { steps: 3 },
    });

    const [msg1, msg2] = await Promise.all([promise1, promise2]);
    expect(JSON.parse(msg1).type).toBe("task:plan_ready");
    expect(JSON.parse(msg2).type).toBe("task:plan_ready");
  });

  it("doit compter les clients connectes", async () => {
    const { connectClient } = await setup();

    expect(wsServer.getClientCount()).toBe(0);
    await connectClient();
    expect(wsServer.getClientCount()).toBe(1);
    await connectClient();
    expect(wsServer.getClientCount()).toBe(2);
  });
});
