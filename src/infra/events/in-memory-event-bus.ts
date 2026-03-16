import type { EventBus, TaskEvent, TaskEventType, TaskEventListener } from "../../domain/orchestration/events.js";
import { logger } from "../../shared/logger.js";

export class InMemoryEventBus implements EventBus {
  private readonly listeners = new Map<TaskEventType, Set<TaskEventListener>>();
  private readonly globalListeners = new Set<TaskEventListener>();

  emit(event: TaskEvent): void {
    logger.debug({ type: event.type, taskId: event.taskId }, "Evenement emis");

    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }

    for (const listener of this.globalListeners) {
      listener(event);
    }
  }

  on(type: TaskEventType, listener: TaskEventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  off(type: TaskEventType, listener: TaskEventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  onAll(listener: TaskEventListener): void {
    this.globalListeners.add(listener);
  }

  offAll(listener: TaskEventListener): void {
    this.globalListeners.delete(listener);
  }
}
