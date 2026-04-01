"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useApi, apiPost, apiPatch } from "@/hooks/use-api";
import { useWebSocket } from "@/hooks/use-websocket";
import { type Message, type Agent } from "@/lib/types";

const STATUS_VARIANT: Record<string, "default" | "info" | "success"> = {
  pending: "info",
  read: "default",
};

export default function MessagesPage() {
  const { data: messages, loading, error, refetch } = useApi<Message[]>("/api/messages");
  const { data: agents } = useApi<Agent[]>("/api/agents");
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [targetAgent, setTargetAgent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "read">("all");

  // Live updates via WebSocket
  const onWsEvent = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      if (event.type.startsWith("message.")) {
        refetch();
      }
    },
    [refetch],
  );

  useWebSocket({ filter: "message.", onEvent: onWsEvent });

  const agentMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setFormError(null);
    const { error } = await apiPost("/api/messages", {
      content: content.trim(),
      targetAgent: targetAgent || undefined,
    });
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    setContent("");
    setTargetAgent("");
    setShowForm(false);
    await refetch();
  }

  async function handleMarkAsRead(id: string) {
    await apiPatch(`/api/messages/${id}`, { status: "read" });
    await refetch();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    await refetch();
  }

  const list = (messages ?? []).filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const pendingCount = (messages ?? []).filter((m) => m.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text">Messages</h1>
          {pendingCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Message"}
        </Button>
      </div>

      {/* New message form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-text">Send Message</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Target Agent (optional)
              </label>
              <select
                value={targetAgent}
                onChange={(e) => setTargetAgent(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
              >
                <option value="">All agents</option>
                {(agents ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Message *
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Message content..."
                required
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {(["all", "pending", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary/10 text-primary"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending" : "Read"}
          </button>
        ))}
      </div>

      {/* Messages list */}
      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-text-secondary">
          {filter === "all" ? "No messages yet." : `No ${filter} messages.`}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg border bg-card p-4 ${
                msg.status === "pending" ? "border-primary/30" : "border-border"
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[msg.status] ?? "default"}>
                    {msg.status}
                  </Badge>
                  {msg.targetAgent && (
                    <span className="text-xs text-text-secondary">
                      To: {agentMap.get(msg.targetAgent) ?? msg.targetAgent}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-secondary">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mb-3 whitespace-pre-wrap text-sm text-text">
                {msg.content}
              </p>
              <div className="flex gap-2">
                {msg.status === "pending" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMarkAsRead(msg.id)}
                  >
                    Mark as Read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(msg.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
