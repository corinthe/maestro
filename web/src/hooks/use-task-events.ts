import { useState, useEffect } from "react";
import { useWebSocket } from "./use-websocket";
import type { TaskEvent } from "../types/events";

export function useTaskEvents(taskId: string) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    setEvents([]);

    const handler = (event: TaskEvent) => {
      if (event.taskId === taskId) {
        setEvents((prev) => [...prev, event]);
      }
    };

    subscribe(handler);
    return () => unsubscribe(handler);
  }, [taskId, subscribe, unsubscribe]);

  return events;
}
