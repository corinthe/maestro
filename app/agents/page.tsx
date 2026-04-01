"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Agent = {
  id: string;
  name: string;
  description: string | null;
  model: string;
  status: string;
  created_at: string;
};

const statusDot: Record<string, string> = {
  idle: "bg-gray-300",
  running: "bg-green-500 animate-pulse",
  stopped: "bg-red-500",
};

const statusLabel: Record<string, string> = {
  idle: "Idle",
  running: "Running",
  stopped: "Stopped",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [submitting, setSubmitting] = useState(false);

  async function fetchAgents() {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          model,
        }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        setModel("claude-sonnet-4-6");
        setShowForm(false);
        await fetchAgents();
      }
    } finally {
      setSubmitting(false);
    }
  }

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
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                placeholder="Agent name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
              />
            </div>
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
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          No agents configured.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
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
                  {statusLabel[agent.status] ?? agent.status}
                </div>
              </div>
              {agent.description && (
                <p className="mb-2 text-xs text-text-secondary">
                  {agent.description}
                </p>
              )}
              <p className="font-mono text-xs text-text-secondary">
                {agent.model}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
