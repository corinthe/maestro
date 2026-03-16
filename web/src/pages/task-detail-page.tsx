import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTask } from "../hooks/use-task";
import { useTaskEvents } from "../hooks/use-task-events";
import { useStreamingOutput } from "../hooks/use-streaming-output";
import { StatusBadge } from "../components/status-badge";
import { StreamingViewer } from "../components/streaming-viewer";
import { ExecutionView } from "../components/execution-view";
import { PlanEditor } from "../components/plan-editor";
import { QuestionAnswerForm } from "../components/question-answer-form";
import { analyzeTask, approveTask, cancelTask, deleteTask, fetchExecutions } from "../services/api-client";
import type { ExecutionPlan } from "../types/task";
import type { TaskExecution } from "../types/execution";

export function TaskDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: task, loading, error, refetch } = useTask(id!);
  const events = useTaskEvents(id!);
  const streaming = useStreamingOutput(id!);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [activeTab, setActiveTab] = useState<"plan" | "executions" | "timeline">("plan");

  const loadExecutions = useCallback(async () => {
    try {
      const data = await fetchExecutions(id!);
      setExecutions(data);
    } catch {
      // Ignore — endpoint may not exist if no executions yet
    }
  }, [id]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Refresh executions when task status changes
  useEffect(() => {
    if (task) {
      loadExecutions();
    }
  }, [task?.status, loadExecutions]);

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
        Chargement...
      </div>
    );
  }

  if (error || !task) {
    return (
      <>
        <Link to="/" className="back-link">
          ← Retour aux taches
        </Link>
        <div className="error-message">
          {error?.message ?? "Tache introuvable"}
        </div>
      </>
    );
  }

  const plan = parsePlan(task.plan);
  const logs = parseLogs(task.agentLogs);
  const canAnalyze = task.status === "inbox";
  const canApprove = task.status === "ready";
  const canCancel = task.status === "running" || task.status === "analyzing";
  const canDelete = task.status !== "running" && task.status !== "analyzing";
  const hasQuestions = plan && plan.questions.length > 0 && task.status === "ready";

  async function handleAnalyze(): Promise<void> {
    setActionLoading(true);
    try {
      await analyzeTask(task!.id);
      refetch();
    } catch {
      // Error will be visible via refetch
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove(): Promise<void> {
    setActionLoading(true);
    try {
      await approveTask(task!.id);
      refetch();
    } catch {
      // Error will be visible via refetch
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(): Promise<void> {
    setActionLoading(true);
    try {
      await cancelTask(task!.id);
      refetch();
    } catch {
      // Error will be visible via refetch
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm("Supprimer cette tache ? Cette action est irreversible.")) return;
    setActionLoading(true);
    try {
      await deleteTask(task!.id);
      navigate("/");
    } catch {
      setActionLoading(false);
    }
  }

  function handlePlanSaved(): void {
    setEditingPlan(false);
    refetch();
  }

  function handleAnswersSubmitted(): void {
    refetch();
  }

  function handleRetry(): void {
    refetch();
    loadExecutions();
  }

  return (
    <>
      <Link to="/" className="back-link">
        ← Retour aux taches
      </Link>

      <div className="task-detail-header">
        <h1>{task.title}</h1>
        <div className="task-detail-meta">
          <StatusBadge status={task.status} />
          <span>Cree le {formatDate(task.createdAt)}</span>
          <span>Mis a jour le {formatDate(task.updatedAt)}</span>
          {task.branch && <span>Branche: {task.branch}</span>}
          {task.prUrl && (
            <a href={task.prUrl} target="_blank" rel="noopener noreferrer">
              Voir la PR
            </a>
          )}
        </div>
        <div className="task-detail-actions">
          {canAnalyze && (
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={actionLoading}
            >
              Lancer l'analyse
            </button>
          )}
          {canApprove && (
            <button
              className="btn btn-success"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              Approuver le plan
            </button>
          )}
          {canCancel && (
            <button
              className="btn btn-danger"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Annuler
            </button>
          )}
          {canDelete && (
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={actionLoading}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      <div className="task-sections">
        {/* Description */}
        <div className="section">
          <div className="section-header">Description</div>
          <div className="section-body">
            <div className="task-description">{task.description}</div>
          </div>
        </div>

        {/* Tabs for Plan / Executions / Timeline */}
        {plan && (
          <div className="section">
            <div className="section-header" style={{ display: "flex", gap: 0 }}>
              <button
                className={`tab-btn ${activeTab === "plan" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("plan")}
              >
                Plan
              </button>
              <button
                className={`tab-btn ${activeTab === "executions" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("executions")}
              >
                Executions{executions.length > 0 ? ` (${executions.length})` : ""}
              </button>
              <button
                className={`tab-btn ${activeTab === "timeline" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("timeline")}
              >
                Timeline
              </button>
            </div>
            <div className="section-body">
              {activeTab === "plan" && (
                <>
                  {editingPlan ? (
                    <PlanEditor
                      taskId={task.id}
                      plan={plan}
                      onSave={handlePlanSaved}
                      onCancel={() => setEditingPlan(false)}
                    />
                  ) : (
                    <>
                      {task.status === "ready" && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setEditingPlan(true)}
                          style={{ marginBottom: 8, fontSize: 12 }}
                        >
                          Editer le plan
                        </button>
                      )}
                      <p style={{ marginBottom: 12, color: "var(--color-text-secondary)", fontSize: 14 }}>
                        {plan.summary}
                      </p>
                      <div className="plan-steps">
                        {plan.steps.map((step) => (
                          <div key={step.order} className="plan-step">
                            <div className="step-order">{step.order}</div>
                            <div className="step-content">
                              <div className="step-agent">{step.agent}</div>
                              <div className="step-task">{step.task}</div>
                              {step.dependsOn.length > 0 && (
                                <div className="step-deps">
                                  Depend de: etape{step.dependsOn.length > 1 ? "s" : ""}{" "}
                                  {step.dependsOn.join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {plan.filesImpacted.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                            Fichiers impactes
                          </div>
                          <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
                            {plan.filesImpacted.join(", ")}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === "executions" && (
                <ExecutionView
                  executions={executions}
                  taskId={task.id}
                  taskStatus={task.status}
                  onRetry={handleRetry}
                />
              )}

              {activeTab === "timeline" && events.length > 0 && (
                <div className="timeline">
                  {events.map((event, i) => (
                    <div key={i} className="timeline-item">
                      <span className="timeline-time">
                        {formatTime(event.timestamp)}
                      </span>
                      <span className="timeline-content">
                        {formatEventType(event.type)}
                        {event.data?.status ? ` → ${event.data.status}` : ""}
                        {event.data?.agentName ? ` (${event.data.agentName})` : ""}
                        {event.data?.agent ? ` (${event.data.agent})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "timeline" && events.length === 0 && (
                <div className="text-secondary">Aucun evenement</div>
              )}
            </div>
          </div>
        )}

        {/* Questions with answer form */}
        {hasQuestions && (
          <div className="section">
            <div className="section-header">Questions de l'orchestrateur</div>
            <div className="section-body">
              <QuestionAnswerForm
                taskId={task.id}
                questions={plan.questions}
                onSubmit={handleAnswersSubmitted}
              />
            </div>
          </div>
        )}

        {/* Streaming output */}
        {(streaming.hasOutput || task.status === "analyzing" || task.status === "running") && (
          <div className="section">
            <div className="section-header">
              Sortie en temps reel
              {streaming.activeAgents.size > 0 && <span className="spinner" style={{ marginLeft: 8, display: "inline-block" }} />}
            </div>
            <div className="section-body">
              <StreamingViewer outputs={streaming.outputs} activeAgents={streaming.activeAgents} />
            </div>
          </div>
        )}

        {/* Logs */}
        {logs && (
          <div className="section">
            <div className="section-header">Logs des agents</div>
            <div className="section-body">
              <div className="log-viewer">{JSON.stringify(logs, null, 2)}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function parsePlan(raw: string | null): ExecutionPlan | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExecutionPlan;
  } catch {
    return null;
  }
}

function parseLogs(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    "task:status_changed": "Statut change",
    "task:plan_ready": "Plan pret",
    "task:plan_updated": "Plan mis a jour",
    "task:agent_started": "Agent demarre",
    "task:agent_output": "Sortie agent",
    "task:agent_completed": "Agent termine",
    "task:pr_opened": "PR ouverte",
    "task:failed": "Echec",
    "task:step_retried": "Etape relancee",
    "task:execution_started": "Execution demarree",
  };
  return labels[type] ?? type;
}
