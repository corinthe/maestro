import { useState } from "react";
import type { TaskExecution } from "../types/execution";
import { StepStatusBadge } from "./step-status-badge";
import { retryStep, retryTask } from "../services/api-client";

interface ExecutionViewProps {
  executions: TaskExecution[];
  taskId: string;
  taskStatus: string;
  onRetry: () => void;
}

export function ExecutionView({ executions, taskId, taskStatus, onRetry }: ExecutionViewProps): React.JSX.Element {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [retryLoading, setRetryLoading] = useState<string | null>(null);
  const [globalFeedback, setGlobalFeedback] = useState("");

  if (executions.length === 0) {
    return <div className="text-secondary">Aucune execution enregistree</div>;
  }

  const latestExecution = executions[executions.length - 1];
  const hasFailedSteps = latestExecution.steps.some((s) => s.status === "failed");
  const canRetry = hasFailedSteps && taskStatus !== "running" && taskStatus !== "analyzing";

  function toggleStep(key: string): void {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleRetryStep(stepOrder: number): Promise<void> {
    const key = `step-${stepOrder}`;
    setRetryLoading(key);
    try {
      await retryStep(taskId, stepOrder, feedbackInputs[key] || undefined);
      onRetry();
    } catch {
      // Error handled by parent refresh
    } finally {
      setRetryLoading(null);
    }
  }

  async function handleRetryAll(): Promise<void> {
    setRetryLoading("all");
    try {
      await retryTask(taskId, globalFeedback || undefined);
      setGlobalFeedback("");
      onRetry();
    } catch {
      // Error handled by parent refresh
    } finally {
      setRetryLoading(null);
    }
  }

  function formatDuration(start: string | null, end: string | null): string {
    if (!start) return "";
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
    return `${Math.round(diffMs / 60000)}min`;
  }

  return (
    <div className="executions">
      {executions.length > 1 && (
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
          {executions.length} executions au total
        </div>
      )}

      {/* Show executions from most recent to oldest */}
      {[...executions].reverse().map((execution, idx) => (
        <div key={execution.id} className="execution-block" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className={`badge badge-${execution.status === "completed" ? "success" : execution.status === "failed" ? "danger" : execution.status === "running" ? "info" : "secondary"}`}>
              {execution.status === "completed" ? "Termine" : execution.status === "failed" ? "Echoue" : execution.status === "running" ? "En cours" : "Annule"}
            </span>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {new Date(execution.startedAt).toLocaleString("fr-FR")}
              {execution.completedAt && ` — ${formatDuration(execution.startedAt, execution.completedAt)}`}
            </span>
            {idx === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-primary)" }}>Dernier</span>}
          </div>

          <div className="plan-steps">
            {execution.steps.map((step) => {
              const stepKey = `${execution.id}-${step.stepOrder}`;
              const isExpanded = expandedSteps.has(stepKey);
              const feedbackKey = `step-${step.stepOrder}`;

              return (
                <div
                  key={step.stepOrder}
                  className={`plan-step ${step.status === "skipped" ? "step-skipped" : ""}`}
                  style={{ opacity: step.status === "skipped" ? 0.6 : 1 }}
                >
                  <div className="step-order">{step.stepOrder}</div>
                  <div className="step-content" style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="step-agent">{step.agent}</span>
                      <StepStatusBadge status={step.status} />
                      {step.attempt > 1 && (
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                          Tentative {step.attempt}
                        </span>
                      )}
                      {(step.startedAt || step.completedAt) && (
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                          {formatDuration(step.startedAt, step.completedAt)}
                        </span>
                      )}
                    </div>
                    <div className="step-task">{step.task}</div>
                    {step.status === "skipped" && (
                      <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--color-text-secondary)" }}>
                        Reutilisee de l'execution precedente
                      </div>
                    )}
                    {step.feedback && (
                      <div style={{ fontSize: 12, marginTop: 4, padding: "4px 8px", background: "var(--color-bg-secondary)", borderRadius: 4 }}>
                        Feedback: {step.feedback}
                      </div>
                    )}

                    {/* Expandable output/error */}
                    {(step.output || step.error) && (
                      <button
                        className="btn-link"
                        onClick={() => toggleStep(stepKey)}
                        style={{ fontSize: 12, marginTop: 4, padding: 0, background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" }}
                      >
                        {isExpanded ? "Masquer" : "Voir"} {step.error ? "l'erreur" : "la sortie"}
                      </button>
                    )}
                    {isExpanded && step.output && (
                      <pre className="log-viewer" style={{ marginTop: 4, maxHeight: 200, overflow: "auto", fontSize: 12 }}>
                        {step.output}
                      </pre>
                    )}
                    {isExpanded && step.error && (
                      <pre className="log-viewer" style={{ marginTop: 4, color: "var(--color-danger)", fontSize: 12 }}>
                        {step.error}
                      </pre>
                    )}

                    {/* Retry button for failed steps in latest execution */}
                    {idx === 0 && step.status === "failed" && canRetry && (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="Feedback optionnel..."
                          value={feedbackInputs[feedbackKey] ?? ""}
                          onChange={(e) => setFeedbackInputs((prev) => ({ ...prev, [feedbackKey]: e.target.value }))}
                          style={{ fontSize: 12, marginBottom: 4, width: "100%", maxWidth: 400 }}
                        />
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleRetryStep(step.stepOrder)}
                          disabled={retryLoading !== null}
                          style={{ fontSize: 12 }}
                        >
                          {retryLoading === feedbackKey ? "Relance..." : "Relancer cette etape"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Global retry button */}
      {canRetry && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--color-bg-secondary)", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Relancer toutes les etapes echouees
          </div>
          <input
            type="text"
            className="input"
            placeholder="Feedback global optionnel..."
            value={globalFeedback}
            onChange={(e) => setGlobalFeedback(e.target.value)}
            style={{ fontSize: 12, marginBottom: 8, width: "100%", maxWidth: 400 }}
          />
          <button
            className="btn btn-warning"
            onClick={handleRetryAll}
            disabled={retryLoading !== null}
            style={{ fontSize: 13 }}
          >
            {retryLoading === "all" ? "Relance en cours..." : "Relancer les etapes echouees"}
          </button>
        </div>
      )}
    </div>
  );
}
