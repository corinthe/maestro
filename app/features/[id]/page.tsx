"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useApi, apiPatch, apiPost } from "@/hooks/use-api";
import {
  type Feature,
  type FeatureStatus,
  type Run,
  type RunStatus,
  type Agent,
  FEATURE_STATUSES,
  FEATURE_STATUS_LABELS,
  FEATURE_STATUS_VARIANT,
  RUN_STATUS_VARIANT,
} from "@/lib/types";

export default function FeatureDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: feature, loading, error, refetch } = useApi<Feature>(`/api/features/${params.id}`);
  const { data: runs } = useApi<Run[]>(`/api/runs?featureId=${params.id}`);
  const { data: agents } = useApi<Agent[]>("/api/agents");
  const [updating, setUpdating] = useState(false);

  // Run form state
  const [showRunForm, setShowRunForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [prompt, setPrompt] = useState("");
  const [startingRun, setStartingRun] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (!feature || updating) return;
    setUpdating(true);
    const { error } = await apiPatch(`/api/features/${params.id}`, { status: newStatus });
    if (!error) await refetch();
    setUpdating(false);
  }

  async function handleStartRun(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent || !prompt.trim()) return;
    setStartingRun(true);
    const res = await apiPost<{ runId: string }>("/api/runs/start", {
      agentId: selectedAgent,
      featureId: params.id,
      prompt: prompt.trim(),
    });
    setStartingRun(false);
    if (res.data?.runId) {
      router.push(`/runs/${res.data.runId}`);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading...</p>;
  }

  if (error || !feature) {
    return (
      <div className="space-y-4">
        <Link href="/features" className="text-sm text-primary hover:underline">
          &larr; Back to Features
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? "Feature not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/features" className="inline-block text-sm text-primary hover:underline">
        &larr; Back to Features
      </Link>

      {/* Feature info */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-text-secondary">{feature.key}</p>
            <h1 className="mt-1 text-xl font-semibold text-text">{feature.title}</h1>
          </div>
          <Badge variant={FEATURE_STATUS_VARIANT[feature.status as FeatureStatus]}>
            {FEATURE_STATUS_LABELS[feature.status as FeatureStatus] ?? feature.status}
          </Badge>
        </div>

        {feature.description && (
          <p className="mb-6 text-sm text-text-secondary whitespace-pre-wrap">{feature.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-text-secondary">Status</p>
            <select
              value={feature.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updating}
              className="mt-1 rounded-md border border-border bg-white px-2 py-1 text-sm text-text outline-none focus:border-primary"
            >
              {FEATURE_STATUSES.map((s) => (
                <option key={s} value={s}>{FEATURE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Priority</p>
            <p className="mt-1 text-text">{feature.priority ?? 0}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Created</p>
            <p className="mt-1 text-text">{new Date(feature.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Updated</p>
            <p className="mt-1 text-text">{new Date(feature.updatedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Runs section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text">Runs</h2>
          <Button size="sm" onClick={() => setShowRunForm(!showRunForm)}>
            {showRunForm ? "Cancel" : "Start Run"}
          </Button>
        </div>

        {/* Start run form */}
        {showRunForm && (
          <form onSubmit={handleStartRun} className="mb-4 space-y-3 rounded-md border border-border p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Agent *</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
                required
              >
                <option value="">Select an agent...</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Prompt *</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Instructions for the agent..."
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={startingRun}>
              {startingRun ? "Starting..." : "Start"}
            </Button>
          </form>
        )}

        {/* Runs list */}
        {(runs ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">No runs yet.</p>
        ) : (
          <div className="space-y-1">
            {(runs ?? []).map((run) => (
              <button
                key={run.id}
                onClick={() => router.push(`/runs/${run.id}`)}
                className="flex w-full items-center gap-3 rounded-md border border-border px-4 py-2.5 text-left transition-colors hover:bg-gray-50 cursor-pointer"
              >
                <Badge variant={RUN_STATUS_VARIANT[run.status as RunStatus] ?? "default"}>
                  {run.status}
                </Badge>
                <span className="flex-1 text-xs text-text-secondary">
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
    </div>
  );
}
