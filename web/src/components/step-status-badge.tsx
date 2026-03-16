import type { StepStatus } from "../types/execution";

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Termine",
  failed: "Echoue",
  skipped: "Reutilise",
};

const STEP_STATUS_CLASSES: Record<StepStatus, string> = {
  pending: "badge badge-secondary",
  running: "badge badge-info",
  completed: "badge badge-success",
  failed: "badge badge-danger",
  skipped: "badge badge-secondary",
};

interface StepStatusBadgeProps {
  status: StepStatus;
}

export function StepStatusBadge({ status }: StepStatusBadgeProps): React.JSX.Element {
  return (
    <span className={STEP_STATUS_CLASSES[status]}>
      {status === "running" && <span className="spinner" style={{ width: 10, height: 10, marginRight: 4, display: "inline-block" }} />}
      {STEP_STATUS_LABELS[status]}
    </span>
  );
}
