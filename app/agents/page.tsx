"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi, apiPost } from "@/hooks/use-api";
import { type Agent, AGENT_STATUS_LABELS, type AgentStatus } from "@/lib/types";

const statusDot: Record<string, string> = {
  idle: "bg-gray-300",
  running: "bg-green-500 animate-pulse",
  stopped: "bg-red-500",
};

function parseModel(config: string): string | null {
  try {
    const parsed = JSON.parse(config);
    return parsed.model ?? null;
  } catch {
    return null;
  }
}

export default function AgentsPage() {
  const { data: agents, loading, error, refetch } = useApi<Agent[]>("/api/agents");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    const { error } = await apiPost("/api/agents", {
      name: name.trim(),
      description: description.trim() || null,
      config: JSON.stringify({ model }),
    });
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    setName("");
    setDescription("");
    setModel("claude-sonnet-4-6");
    setShowForm(false);
    await refetch();
  }

  const list = agents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Agents</h1>
        <Button onClick={() => setShowForm(true)}>+ New Agent</Button>
      </div>

      {/* New agent form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-text">
            Add New Agent
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Name *
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Agent name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Description
              </label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Model
              </label>
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={submitting} size="sm">
                {submitting ? "Adding..." : "Add Agent"}
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

      {/* Agents list */}
      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No agents configured.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((agent) => {
            const agentModel = parseModel(agent.config);
            return (
              <div
                key={agent.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text">{agent.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${statusDot[agent.status] ?? "bg-gray-300"}`}
                    />
                    {AGENT_STATUS_LABELS[agent.status as AgentStatus] ?? agent.status}
                  </div>
                </div>
                {agent.description && (
                  <p className="mb-2 text-xs text-text-secondary">
                    {agent.description}
                  </p>
                )}
                {agentModel && (
                  <p className="font-mono text-xs text-text-secondary">
                    {agentModel}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
