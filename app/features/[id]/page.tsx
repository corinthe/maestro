"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Feature = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  assigned_agent: string | null;
  branch: string | null;
  created_at: string;
  updated_at: string;
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

const allStatuses = ["backlog", "in_progress", "done", "cancelled"];

export default function FeatureDetailPage() {
  const params = useParams<{ id: string }>();
  const [feature, setFeature] = useState<Feature | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function fetchFeature() {
    try {
      const res = await fetch(`/api/features/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setFeature(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeature();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(newStatus: string) {
    if (!feature || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/features/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeature(data);
      }
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading...</p>;
  }

  if (!feature) {
    return (
      <div className="space-y-4">
        <Link
          href="/features"
          className="text-sm text-primary hover:underline"
        >
          &larr; Back to Features
        </Link>
        <p className="text-sm text-text-secondary">Feature not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/features"
        className="inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Features
      </Link>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-text-secondary">
              {feature.key}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-text">
              {feature.title}
            </h1>
          </div>
          <Badge variant={statusVariant[feature.status]}>
            {statusLabel[feature.status] ?? feature.status}
          </Badge>
        </div>

        {feature.description && (
          <p className="mb-6 text-sm text-text-secondary whitespace-pre-wrap">
            {feature.description}
          </p>
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
              {allStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Priority</p>
            <p className="mt-1 text-text">{feature.priority}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Assigned Agent
            </p>
            <p className="mt-1 text-text">
              {feature.assigned_agent ?? "Unassigned"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Branch</p>
            <p className="mt-1 font-mono text-text">
              {feature.branch ?? "None"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Created</p>
            <p className="mt-1 text-text">
              {new Date(feature.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Updated</p>
            <p className="mt-1 text-text">
              {new Date(feature.updated_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
