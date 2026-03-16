import { useState } from "react";
import { Link } from "react-router-dom";
import { useTasks } from "../hooks/use-tasks";
import { StatusBadge } from "../components/status-badge";
import { CreateTaskModal } from "../components/create-task-modal";
import { TASK_STATUSES, type TaskStatus } from "../types/task";

export function TaskListPage(): React.JSX.Element {
  const [filter, setFilter] = useState<TaskStatus | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const { data: tasks, loading, error, refetch } = useTasks(filter);

  return (
    <>
      <div className="page-header">
        <h1>Tâches</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nouvelle tache
        </button>
      </div>

      <div className="task-filters">
        <button
          className={`filter-btn ${filter === undefined ? "active" : ""}`}
          onClick={() => setFilter(undefined)}
        >
          Toutes
        </button>
        {TASK_STATUSES.map((s) => (
          <button
            key={s}
            className={`filter-btn ${filter === s ? "active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading">
          <span className="spinner" />
          Chargement...
        </div>
      )}

      {error && <div className="error-message">{error.message}</div>}

      {tasks && tasks.length === 0 && (
        <div className="empty-state">
          <p>Aucune tache{filter ? ` en statut "${filter}"` : ""}.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Creer une tache
          </button>
        </div>
      )}

      {tasks && tasks.length > 0 && (
        <div className="task-list">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="card card-hover task-card"
            >
              <div className="task-card-content">
                <div className="task-card-title">{task.title}</div>
                <div className="task-card-meta">
                  <span>{formatDate(task.createdAt)}</span>
                  {task.prUrl && <span>PR ouverte</span>}
                  {task.branch && <span>{task.branch}</span>}
                </div>
              </div>
              <div className="task-card-actions">
                <StatusBadge status={task.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <CreateTaskModal
          onClose={() => setShowModal(false)}
          onCreated={refetch}
        />
      )}
    </>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
