import { useState } from "react";
import type { ExecutionPlan, PlanStep } from "../types/task";
import { updatePlan } from "../services/api-client";

interface PlanEditorProps {
  taskId: string;
  plan: ExecutionPlan;
  onSave: () => void;
  onCancel: () => void;
}

export function PlanEditor({ taskId, plan, onSave, onCancel }: PlanEditorProps): React.JSX.Element {
  const [editedPlan, setEditedPlan] = useState<ExecutionPlan>(() => structuredClone(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStep(index: number, field: keyof PlanStep, value: unknown): void {
    setEditedPlan((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function addStep(): void {
    const maxOrder = editedPlan.steps.reduce((max, s) => Math.max(max, s.order), 0);
    setEditedPlan((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { order: maxOrder + 1, agent: "", task: "", dependsOn: [], parallel: false },
      ],
    }));
  }

  function removeStep(index: number): void {
    setEditedPlan((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }

  function moveStep(index: number, direction: -1 | 1): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editedPlan.steps.length) return;
    setEditedPlan((prev) => {
      const steps = [...prev.steps];
      [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
      return { ...prev, steps };
    });
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await updatePlan(taskId, editedPlan);
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  const isValid = editedPlan.summary.length > 0 &&
    editedPlan.steps.length > 0 &&
    editedPlan.steps.every((s) => s.agent.length > 0 && s.task.length > 0);

  return (
    <div className="plan-editor">
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Resume</label>
        <textarea
          className="input"
          value={editedPlan.summary}
          onChange={(e) => setEditedPlan((prev) => ({ ...prev, summary: e.target.value }))}
          rows={2}
          style={{ width: "100%", resize: "vertical" }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Etapes</label>
          <button className="btn btn-sm btn-secondary" onClick={addStep} style={{ fontSize: 11 }}>
            + Ajouter une etape
          </button>
        </div>

        {editedPlan.steps.map((step, index) => (
          <div key={index} className="plan-step" style={{ marginBottom: 8, padding: 8, background: "var(--color-bg-secondary)", borderRadius: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 20 }}>{step.order}</span>
              <input
                type="text"
                className="input"
                placeholder="Agent"
                value={step.agent}
                onChange={(e) => updateStep(index, "agent", e.target.value)}
                style={{ fontSize: 12, flex: 1, maxWidth: 150 }}
              />
              <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={step.parallel}
                  onChange={(e) => updateStep(index, "parallel", e.target.checked)}
                />
                Parallele
              </label>
              <div style={{ display: "flex", gap: 2 }}>
                <button className="btn-link" onClick={() => moveStep(index, -1)} disabled={index === 0} style={{ fontSize: 14, padding: "0 4px" }}>
                  ↑
                </button>
                <button className="btn-link" onClick={() => moveStep(index, 1)} disabled={index === editedPlan.steps.length - 1} style={{ fontSize: 14, padding: "0 4px" }}>
                  ↓
                </button>
                <button className="btn-link" onClick={() => removeStep(index)} style={{ fontSize: 14, padding: "0 4px", color: "var(--color-danger)" }}>
                  ×
                </button>
              </div>
            </div>
            <textarea
              className="input"
              placeholder="Description de l'etape"
              value={step.task}
              onChange={(e) => updateStep(index, "task", e.target.value)}
              rows={2}
              style={{ width: "100%", fontSize: 12, resize: "vertical" }}
            />
            <input
              type="text"
              className="input"
              placeholder="Depend de (ex: 1,2)"
              value={step.dependsOn.join(",")}
              onChange={(e) => {
                const deps = e.target.value
                  .split(",")
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => !isNaN(n));
                updateStep(index, "dependsOn", deps);
              }}
              style={{ fontSize: 11, marginTop: 4 }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Fichiers impactes</label>
        <input
          type="text"
          className="input"
          value={editedPlan.filesImpacted.join(", ")}
          onChange={(e) => setEditedPlan((prev) => ({
            ...prev,
            filesImpacted: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
          }))}
          style={{ width: "100%", fontSize: 12 }}
          placeholder="src/foo.ts, src/bar.ts"
        />
      </div>

      {error && <div className="error-message" style={{ marginBottom: 8 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isValid}>
          {saving ? "Sauvegarde..." : "Sauvegarder le plan"}
        </button>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
      </div>
    </div>
  );
}
