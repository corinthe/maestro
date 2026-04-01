"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RunEvent } from "@/components/runs/run-event";
import { useApi, apiPost } from "@/hooks/use-api";
import { useWebSocket } from "@/hooks/use-websocket";
import { type Run, type RunStatus } from "@/lib/types";

type EventData = {
  type: string;
  subtype?: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: string;
  isError?: boolean;
  sessionId?: string;
  model?: string;
  summary?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
};

const RUN_STATUS_VARIANT: Record<string, "default" | "info" | "success" | "error" | "warning"> = {
  queued: "default",
  running: "info",
  succeeded: "success",
  failed: "error",
  stopped: "warning",
  timed_out: "error",
};

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const { data: run, loading, error, refetch } = useApi<Run>(`/api/runs/${runId}`);
  const [events, setEvents] = useState<EventData[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [stopping, setStopping] = useState(false);

  // Load historical events
  useEffect(() => {
    fetch(`/api/runs/${runId}/events?limit=1000`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          const parsed = json.data.map((e: { data: string }) => {
            try {
              return JSON.parse(e.data);
            } catch {
              return null;
            }
          }).filter(Boolean);
          setEvents(parsed);
        }
      })
      .catch(() => {});
  }, [runId]);

  // WebSocket for live events
  const onWsEvent = useCallback(
    (wsEvent: { type: string; [key: string]: unknown }) => {
      if (wsEvent.type === "run.event" && wsEvent.runId === runId) {
        const event = wsEvent.event as EventData;
        setEvents((prev) => [...prev, event]);
      }
      if (wsEvent.type === "run.status" && wsEvent.runId === runId) {
        setLiveStatus(wsEvent.status as string);
        refetch();
      }
    },
    [runId, refetch]
  );

  const { connected } = useWebSocket({
    filter: "run.",
    onEvent: onWsEvent,
  });

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }

  async function handleStop() {
    setStopping(true);
    await apiPost(`/api/runs/${runId}/stop`, {});
    setStopping(false);
  }

  async function handleRestart() {
    const res = await apiPost<{ runId: string }>(`/api/runs/${runId}/restart`, {});
    if (res.data?.runId) {
      window.location.href = `/runs/${res.data.runId}`;
    }
  }

  const currentStatus = liveStatus ?? run?.status ?? "unknown";
  const isRunning = currentStatus === "running";

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading...</p>;
  }

  if (error || !run) {
    return (
      <div className="space-y-4">
        <Link href="/features" className="text-sm text-primary hover:underline">
          &larr; Back
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? "Run not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/features" className="text-sm text-primary hover:underline">
            &larr; Back
          </Link>
          <h1 className="text-lg font-semibold text-text">
            Run
          </h1>
          <Badge variant={RUN_STATUS_VARIANT[currentStatus] ?? "default"}>
            {currentStatus}
          </Badge>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          {connected && isRunning && (
            <span className="text-xs text-text-secondary">WS connected</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              disabled={stopping}
            >
              {stopping ? "Stopping..." : "Stop"}
            </Button>
          )}
          {!isRunning && currentStatus !== "queued" && (
            <Button variant="secondary" size="sm" onClick={handleRestart}>
              Restart
            </Button>
          )}
        </div>
      </div>

      {/* Run info */}
      <div className="flex gap-4 text-xs text-text-secondary">
        {run.model && <span>Model: {run.model}</span>}
        {run.agentId && <span>Agent: {run.agentId}</span>}
        {run.startedAt && <span>Started: {new Date(run.startedAt).toLocaleString()}</span>}
        {run.finishedAt && <span>Finished: {new Date(run.finishedAt).toLocaleString()}</span>}
        {run.costUsd != null && run.costUsd > 0 && <span>Cost: ${run.costUsd.toFixed(4)}</span>}
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded-lg border border-border bg-white p-4"
      >
        <div className="flex flex-col gap-2">
          {events.length === 0 && (
            <p className="text-sm text-text-secondary">
              {isRunning ? "Waiting for events..." : "No events recorded."}
            </p>
          )}
          {events.map((event, i) => (
            <RunEvent key={i} event={event} />
          ))}
        </div>
      </div>

      {/* Metrics summary (when finished) */}
      {!isRunning && run.inputTokens != null && run.inputTokens > 0 && (
        <div className="flex gap-6 rounded-lg border border-border bg-card px-4 py-3 text-xs text-text-secondary">
          <span>Input: {run.inputTokens?.toLocaleString()} tokens</span>
          <span>Output: {run.outputTokens?.toLocaleString()} tokens</span>
          {run.cachedTokens != null && run.cachedTokens > 0 && (
            <span>Cached: {run.cachedTokens.toLocaleString()} tokens</span>
          )}
          <span>Cost: ${(run.costUsd ?? 0).toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}
