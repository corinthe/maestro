import { useEffect, useCallback } from "react";
import { useApi } from "./use-api";
import { useWebSocket } from "./use-websocket";
import { fetchTask } from "../services/api-client";
import type { TaskEvent } from "../types/events";

export function useTask(id: string) {
  const fetcher = useCallback(() => fetchTask(id), [id]);
  const result = useApi(fetcher, [id]);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    const handler: (event: TaskEvent) => void = (event) => {
      if (event.taskId === id) {
        result.refetch();
      }
    };
    subscribe(handler);
    return () => unsubscribe(handler);
  }, [id, subscribe, unsubscribe, result.refetch]);

  return result;
}
