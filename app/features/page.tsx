"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { useApi, apiPost } from "@/hooks/use-api";
import { type Feature, FEATURE_STATUS_LABELS, FEATURE_STATUS_VARIANT, type FeatureStatus } from "@/lib/types";

export default function FeaturesPage() {
  const router = useRouter();
  const { data: features, loading, error, refetch } = useApi<Feature[]>("/api/features");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError(null);
    const { error } = await apiPost("/api/features", {
      title: title.trim(),
      description: description.trim() || null,
      priority,
    });
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    setTitle("");
    setDescription("");
    setPriority(0);
    setShowForm(false);
    await refetch();
  }

  const list = features ?? [];
  const grouped = {
    in_progress: list.filter((f) => f.status === "in_progress"),
    backlog: list.filter((f) => f.status === "backlog"),
    done: list.filter((f) => f.status === "done"),
    cancelled: list.filter((f) => f.status === "cancelled"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Features</h1>
        <Button onClick={() => setShowForm(true)}>+ New Feature</Button>
      </div>

      {/* New feature form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-text">
            Create New Feature
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Title *
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Feature title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Priority
              </label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-24"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={submitting} size="sm">
                {submitting ? "Creating..." : "Create Feature"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Features list */}
      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No features yet. Create your first feature to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {(
            ["in_progress", "backlog", "done", "cancelled"] as FeatureStatus[]
          ).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-2 text-sm font-medium text-text-secondary">
                  {FEATURE_STATUS_LABELS[status]} ({items.length})
                </h2>
                <div className="space-y-1">
                  {items.map((feature) => (
                    <button
                      key={feature.id}
                      onClick={() => router.push(`/features/${feature.id}`)}
                      className="flex w-full items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer"
                    >
                      <span className="text-xs font-medium text-text-secondary">
                        {feature.key}
                      </span>
                      <span className="flex-1 text-sm text-text">
                        {feature.title}
                      </span>
                      <Badge variant={FEATURE_STATUS_VARIANT[feature.status as FeatureStatus]}>
                        {FEATURE_STATUS_LABELS[feature.status as FeatureStatus] ?? feature.status}
                      </Badge>
                      {feature.agentId && (
                        <span className="text-xs text-text-secondary">
                          {feature.agentId}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
