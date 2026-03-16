import type { TaskEvent } from "../types/events";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";
export type EventCallback = (event: TaskEvent) => void;
export type StatusCallback = (status: ConnectionStatus) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<EventCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private _status: ConnectionStatus = "disconnected";
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url?: string) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = url ?? `${protocol}//${window.location.host}/ws`;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as TaskEvent;
          this.listeners.forEach((cb) => cb(parsed));
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.setStatus("reconnecting");
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.setStatus("reconnecting");
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }

  subscribe(callback: EventCallback): void {
    this.listeners.add(callback);
  }

  unsubscribe(callback: EventCallback): void {
    this.listeners.delete(callback);
  }

  onStatusChange(callback: StatusCallback): void {
    this.statusListeners.add(callback);
  }

  offStatusChange(callback: StatusCallback): void {
    this.statusListeners.delete(callback);
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
