"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Feature = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  assigned_agent: string | null;
  created_at: string;
};

const statusVariant: Record<string, "default" | "info" | "success" | "error"> =
  {
    backlog: "default",
    in_progress: "info",
    done: "success",
    cancelled: "error",
  };

const statusLabel: Record<string, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

export default function FeaturesPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function fetchFeatures() {
    try {
      const res = await fetch("/api/features");
      if (res.ok) {
        const data = await res.json();
        setFeatures(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeatures();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, priority }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setPriority(0);
        setShowForm(false);
        await fetchFeatures();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = {
    in_progress: features.filter((f) => f.status === "in_progress"),
    backlog: features.filter((f) => f.status === "backlog"),
    done: features.filter((f) => f.status === "done"),
    cancelled: features.filter((f) => f.status === "cancelled"),
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
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                placeholder="Feature title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Priority
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-24 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              />
            </div>
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
      ) : features.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No features yet. Create your first feature to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {(
            ["in_progress", "backlog", "done", "cancelled"] as const
          ).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-2 text-sm font-medium text-text-secondary">
                  {statusLabel[status]} ({items.length})
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
                      <Badge variant={statusVariant[feature.status]}>
                        {statusLabel[feature.status] ?? feature.status}
                      </Badge>
                      {feature.assigned_agent && (
                        <span className="text-xs text-text-secondary">
                          {feature.assigned_agent}
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
