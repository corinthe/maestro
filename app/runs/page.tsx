"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { type Run } from "@/lib/types";

const RUN_STATUS_VARIANT: Record<string, "default" | "info" | "success" | "error" | "warning"> = {
  queued: "default",
  running: "info",
  succeeded: "success",
  failed: "error",
  stopped: "warning",
  timed_out: "error",
};

export default function RunsPage() {
  const router = useRouter();
  const { data: runs, loading, error } = useApi<Run[]>("/api/runs");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text">Runs</h1>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (runs ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No runs yet. Start a run from a feature page.
        </div>
      ) : (
        <div className="space-y-1">
          {(runs ?? []).map((run) => (
            <button
              key={run.id}
              onClick={() => router.push(`/runs/${run.id}`)}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer"
            >
              <Badge variant={RUN_STATUS_VARIANT[run.status] ?? "default"}>
                {run.status}
              </Badge>
              <span className="text-xs font-medium text-text-secondary">
                {run.runType}
              </span>
              <span className="flex-1 text-sm text-text">
                {run.model ?? "unknown model"}
              </span>
              <span className="text-xs text-text-secondary">
                {new Date(run.createdAt).toLocaleString()}
              </span>
              {run.costUsd != null && run.costUsd > 0 && (
                <span className="text-xs text-text-secondary">${run.costUsd.toFixed(4)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
