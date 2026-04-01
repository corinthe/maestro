"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useApi, apiPatch } from "@/hooks/use-api";
import {
  type Feature,
  type FeatureStatus,
  FEATURE_STATUSES,
  FEATURE_STATUS_LABELS,
  FEATURE_STATUS_VARIANT,
} from "@/lib/types";

export default function FeatureDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: feature, loading, error, refetch } = useApi<Feature>(`/api/features/${params.id}`);
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (!feature || updating) return;
    setUpdating(true);
    const { error } = await apiPatch(`/api/features/${params.id}`, { status: newStatus });
    if (!error) {
      await refetch();
    }
    setUpdating(false);
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading...</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/features"
          className="text-sm text-primary hover:underline"
        >
          &larr; Back to Features
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
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
          <Badge variant={FEATURE_STATUS_VARIANT[feature.status as FeatureStatus]}>
            {FEATURE_STATUS_LABELS[feature.status as FeatureStatus] ?? feature.status}
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
              {FEATURE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FEATURE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Priority</p>
            <p className="mt-1 text-text">{feature.priority ?? 0}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Assigned Agent
            </p>
            <p className="mt-1 text-text">
              {feature.agentId ?? "Unassigned"}
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
              {new Date(feature.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">Updated</p>
            <p className="mt-1 text-text">
              {new Date(feature.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
