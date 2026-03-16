import { describe, it, expect, vi } from "vitest";
import { InMemoryEventBus } from "./in-memory-event-bus.js";
import type { TaskEvent } from "../../domain/orchestration/events.js";

function createEvent(type: TaskEvent["type"], taskId = "task-1"): TaskEvent {
  return { type, taskId, timestamp: new Date(), data: {} };
}

describe("InMemoryEventBus", () => {
  it("doit notifier les listeners inscrits sur un type d'evenement", () => {
    const bus = new InMemoryEventBus();
    const listener = vi.fn();

    bus.on("task:status_changed", listener);
    bus.emit(createEvent("task:status_changed"));

    expect(listener).toHaveBeenCalledOnce();
  });

  it("ne doit pas notifier les listeners d'un autre type", () => {
    const bus = new InMemoryEventBus();
    const listener = vi.fn();

    bus.on("task:plan_ready", listener);
    bus.emit(createEvent("task:status_changed"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("doit notifier les listeners globaux pour tous les evenements", () => {
    const bus = new InMemoryEventBus();
    const listener = vi.fn();

    bus.onAll(listener);
    bus.emit(createEvent("task:status_changed"));
    bus.emit(createEvent("task:agent_started"));

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("doit permettre de se desinscrire d'un type", () => {
    const bus = new InMemoryEventBus();
    const listener = vi.fn();

    bus.on("task:status_changed", listener);
    bus.off("task:status_changed", listener);
    bus.emit(createEvent("task:status_changed"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("doit permettre de se desinscrire globalement", () => {
    const bus = new InMemoryEventBus();
    const listener = vi.fn();

    bus.onAll(listener);
    bus.offAll(listener);
    bus.emit(createEvent("task:status_changed"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("doit transmettre l'evenement complet au listener", () => {
    const bus = new InMemoryEventBus();
    const listener = vi.fn();
    const event = createEvent("task:agent_completed", "task-42");
    event.data = { agent: "backend", result: "success" };

    bus.on("task:agent_completed", listener);
    bus.emit(event);

    expect(listener).toHaveBeenCalledWith(event);
  });

  it("doit supporter plusieurs listeners sur le meme type", () => {
    const bus = new InMemoryEventBus();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    bus.on("task:failed", listener1);
    bus.on("task:failed", listener2);
    bus.emit(createEvent("task:failed"));

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });
});
