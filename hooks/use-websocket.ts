"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type WsEvent = {
  type: string;
  [key: string]: unknown;
};

type UseWebSocketOptions = {
  /** Filter events by type prefix, e.g. "run." */
  filter?: string;
  /** Called for each matching event */
  onEvent?: (event: WsEvent) => void;
};

export function useWebSocket(opts?: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let unmounted = false;
    let reconnectDelay = 1000;

    function connect() {
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT ?? "4201";
      const wsUrl = `ws://${window.location.hostname}:${wsPort}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!unmounted) {
          setConnected(true);
          reconnectDelay = 1000; // reset on successful connect
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setConnected(false);
          reconnectTimeout = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as WsEvent;
          const filter = optsRef.current?.filter;
          if (filter && !data.type.startsWith(filter)) return;
          optsRef.current?.onEvent?.(data);
        } catch {
          // ignore malformed messages
        }
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout);
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
