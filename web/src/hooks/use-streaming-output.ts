import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "./use-websocket";
import type { TaskEvent } from "../types/events";

interface StreamingState {
  /** Output accumule par agent (cle = nom de l'agent) */
  outputs: Record<string, string>;
  /** Agents actuellement en train de streamer */
  activeAgents: Set<string>;
}

export function useStreamingOutput(taskId: string) {
  const [state, setState] = useState<StreamingState>({
    outputs: {},
    activeAgents: new Set(),
  });
  const { subscribe, unsubscribe } = useWebSocket();
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => {
    setState({ outputs: {}, activeAgents: new Set() });
  }, []);

  useEffect(() => {
    reset();

    const handler = (event: TaskEvent) => {
      if (event.taskId !== taskId) return;

      if (event.type === "task:agent_output" && event.data.streaming) {
        const agent = event.data.agent as string;
        const chunk = event.data.chunk as string;

        setState((prev) => ({
          outputs: {
            ...prev.outputs,
            [agent]: (prev.outputs[agent] ?? "") + chunk,
          },
          activeAgents: new Set([...prev.activeAgents, agent]),
        }));
      }

      if (event.type === "task:agent_completed") {
        const agent = event.data.agent as string;
        setState((prev) => {
          const next = new Set(prev.activeAgents);
          next.delete(agent);
          return { ...prev, activeAgents: next };
        });
      }

      if (event.type === "task:status_changed") {
        const to = event.data.to as string;
        if (to === "ready" || to === "failed") {
          setState((prev) => ({ ...prev, activeAgents: new Set() }));
        }
      }
    };

    subscribe(handler);
    return () => unsubscribe(handler);
  }, [taskId, subscribe, unsubscribe, reset]);

  return {
    outputs: state.outputs,
    activeAgents: state.activeAgents,
    hasOutput: Object.keys(state.outputs).length > 0,
    reset,
  };
}
