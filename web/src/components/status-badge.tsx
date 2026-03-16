import type { TaskStatus } from "../types/task";

const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  analyzing: "Analyse",
  ready: "Pret",
  approved: "Approuve",
  running: "En cours",
  review: "Review",
  done: "Termine",
  failed: "Echoue",
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  return (
    <span className={`badge badge-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
