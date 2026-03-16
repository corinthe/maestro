import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  WebSocketClient,
  type ConnectionStatus,
  type EventCallback,
} from "../services/websocket-client";

interface WebSocketContextValue {
  status: ConnectionStatus;
  subscribe: (callback: EventCallback) => void;
  unsubscribe: (callback: EventCallback) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const client = new WebSocketClient();
    clientRef.current = client;

    client.onStatusChange(setStatus);
    client.connect();

    return () => {
      client.disconnect();
    };
  }, []);

  const value: WebSocketContextValue = {
    status,
    subscribe: (cb) => clientRef.current?.subscribe(cb),
    unsubscribe: (cb) => clientRef.current?.unsubscribe(cb),
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket doit etre utilise dans un WebSocketProvider");
  }
  return ctx;
}
