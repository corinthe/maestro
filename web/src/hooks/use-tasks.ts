import { useEffect, useCallback } from "react";
import { useApi } from "./use-api";
import { useWebSocket } from "./use-websocket";
import { fetchTasks } from "../services/api-client";
import type { TaskStatus } from "../types/task";
import type { TaskEvent } from "../types/events";

export function useTasks(status?: TaskStatus) {
  const fetcher = useCallback(() => fetchTasks(status), [status]);
  const result = useApi(fetcher, [status]);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    const handler: (event: TaskEvent) => void = (event) => {
      if (event.type === "task:status_changed") {
        result.refetch();
      }
    };
    subscribe(handler);
    return () => unsubscribe(handler);
  }, [subscribe, unsubscribe, result.refetch]);

  return result;
}
