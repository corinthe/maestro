import { useState } from 'react';
import type { Task, TaskStatus } from '../types';

interface Props {
  tasks: Task[];
  onMoveTask?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (task: { title: string; description: string; acceptanceCriteria: string[] }) => Promise<void>;
}

const COLUMNS: { status: TaskStatus; label: string; color: string; dot: string }[] = [
  { status: 'backlog',     label: 'Backlog',      color: 'border-slate-600',  dot: 'bg-slate-400' },
  { status: 'in-progress', label: 'In Progress',  color: 'border-blue-500',   dot: 'bg-blue-400' },
  { status: 'done',        label: 'Done',         color: 'border-emerald-500', dot: 'bg-emerald-400' },
  { status: 'blocked',     label: 'Blocked',      color: 'border-red-500',    dot: 'bg-red-400' },
];

function TaskCard({ task, onDragStart }: { task: Task; onDragStart: (id: string) => void }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-slate-500 transition-colors group"
    >
      <div className="text-sm font-medium text-slate-100 mb-1 leading-snug">{task.title}</div>
      {task.agent && (
        <div className="text-xs text-blue-400 mb-1">@{task.agent}</div>
      )}
      <div className="text-xs text-slate-400 line-clamp-2 mb-2">{task.description}</div>
      {task.filesLocked && task.filesLocked.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {task.filesLocked.slice(0, 2).map((f) => (
            <span key={f} className="text-xs bg-amber-900/50 text-amber-300 rounded px-1.5 py-0.5 font-mono truncate max-w-[120px]">
              {f.split('/').pop()}
            </span>
          ))}
          {task.filesLocked.length > 2 && (
            <span className="text-xs text-slate-500">+{task.filesLocked.length - 2}</span>
          )}
        </div>
      )}
      {task.blockedReason && (
        <div className="mt-1 text-xs text-red-400 italic">{task.blockedReason}</div>
      )}
      <div className="text-xs text-slate-600 mt-2 font-mono">{task.id}</div>
    </div>
  );
}

function QuickAddTask({ onAddTask }: { onAddTask: (task: { title: string; description: string; acceptanceCriteria: string[] }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onAddTask({ title: title.trim(), description: description.trim(), acceptanceCriteria: [] });
      setTitle('');
      setDescription('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors"
      >
        + Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-600 rounded-lg p-3 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        autoFocus
        className="w-full bg-slate-900/70 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="w-full bg-slate-900/70 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); setDescription(''); setError(''); }}
          className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || !description.trim() || loading}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium rounded transition-colors"
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}

export default function KanbanBoard({ tasks, onMoveTask, onAddTask }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const grouped = COLUMNS.reduce<Record<TaskStatus, Task[]>>(
    (acc, col) => {
      acc[col.status] = tasks.filter((t) => t.status === col.status);
      return acc;
    },
    { backlog: [], 'in-progress': [], done: [], blocked: [] },
  );

  const handleDrop = (status: TaskStatus) => {
    if (draggingId && onMoveTask) {
      onMoveTask(draggingId, status);
    }
    setDraggingId(null);
    setOverCol(null);
  };

  return (
    <div className="grid grid-cols-4 gap-4 h-full">
      {COLUMNS.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.status); }}
          onDragLeave={() => setOverCol(null)}
          onDrop={() => handleDrop(col.status)}
          className={`flex flex-col rounded-xl border-2 transition-colors ${col.color} ${
            overCol === col.status ? 'bg-slate-800/60' : 'bg-slate-900/40'
          }`}
        >
          {/* Column header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/50">
            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
            <span className="text-sm font-semibold text-slate-200">{col.label}</span>
            <span className="ml-auto text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5">
              {grouped[col.status].length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
            {grouped[col.status].length === 0 && !(col.status === 'backlog' && onAddTask) && (
              <div className="text-xs text-slate-600 text-center py-8 italic">Empty</div>
            )}
            {grouped[col.status].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDragStart={setDraggingId}
              />
            ))}
            {col.status === 'backlog' && onAddTask && (
              <QuickAddTask onAddTask={onAddTask} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
