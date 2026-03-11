import { useState } from 'react';
import type { Task, TaskStatus } from '../types';

interface Props {
  tasks: Task[];
  onMoveTask?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (task: { title: string; description: string; acceptanceCriteria: string[] }) => Promise<void>;
  onSelectTask?: (taskId: string) => void;
}

const COLUMNS: { status: TaskStatus; label: string; border: string; dot: string }[] = [
  { status: 'backlog',     label: 'Backlog',      border: 'border-stone-700',   dot: 'bg-stone-500' },
  { status: 'plan',        label: 'Plan',         border: 'border-blue-700/60', dot: 'bg-blue-500' },
  { status: 'in-progress', label: 'In Progress',  border: 'border-amber-700/60', dot: 'bg-amber-500' },
  { status: 'done',        label: 'Done',         border: 'border-emerald-800/60', dot: 'bg-emerald-500' },
  { status: 'blocked',     label: 'Blocked',      border: 'border-red-900/60',  dot: 'bg-red-500' },
];

function PlanningBadge({ task }: { task: Task }) {
  if (!task.planningPhase || task.planningPhase === 'approved') return null;

  const isReview = task.planningPhase.endsWith('-review');
  const isFunctional = task.planningPhase.startsWith('functional');

  const label = isFunctional ? 'Functional Plan' : 'Technical Plan';
  const sublabel = isReview ? 'Needs review' : 'In progress';
  const color = isFunctional
    ? 'bg-blue-950/50 text-blue-400 border-blue-900/50'
    : 'bg-purple-950/50 text-purple-400 border-purple-900/50';

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border mb-1.5 ${color}`}>
      {isReview && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-soft" />}
      {label} — {sublabel}
    </div>
  );
}

function TaskCard({ task, onDragStart, onClick }: { task: Task; onDragStart: (id: string) => void; onClick?: () => void }) {
  const hasPlanning = task.planningPhase && task.planningPhase !== 'approved';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={hasPlanning ? onClick : undefined}
      className={`bg-stone-800/80 border border-stone-700/60 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-stone-600 hover:bg-stone-800 transition-all duration-150 animate-fade-in ${
        hasPlanning ? 'cursor-pointer ring-1 ring-amber-900/30' : ''
      }`}
    >
      <PlanningBadge task={task} />
      <div className="text-sm font-medium text-stone-100 mb-1 leading-snug">{task.title}</div>
      {task.agent && (
        <div className="text-xs text-amber-400 mb-1">@{task.agent}</div>
      )}
      <div className="text-xs text-stone-400 line-clamp-2 mb-2">{task.description}</div>
      {task.filesLocked && task.filesLocked.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {task.filesLocked.slice(0, 2).map((f) => (
            <span key={f} className="text-xs bg-amber-950/50 text-amber-400/80 rounded px-1.5 py-0.5 font-mono truncate max-w-[120px]">
              {f.split('/').pop()}
            </span>
          ))}
          {task.filesLocked.length > 2 && (
            <span className="text-xs text-stone-600">+{task.filesLocked.length - 2}</span>
          )}
        </div>
      )}
      {task.blockedReason && (
        <div className="mt-1 text-xs text-red-400/80 italic">{task.blockedReason}</div>
      )}
      <div className="text-xs text-stone-600 mt-2 font-mono">{task.id}</div>
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
        className="w-full py-2 text-xs text-stone-600 hover:text-stone-300 hover:bg-stone-800/60 rounded-lg transition-all duration-150"
      >
        + Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-800/80 border border-stone-700 rounded-lg p-3 space-y-2 animate-scale-in">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        autoFocus
        className="w-full bg-stone-900/70 border border-stone-700 rounded px-2 py-1.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 transition-all duration-150"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="w-full bg-stone-900/70 border border-stone-700 rounded px-2 py-1.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none transition-all duration-150"
      />
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(''); setDescription(''); setError(''); }}
          className="px-3 py-1 text-xs text-stone-500 hover:text-stone-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || !description.trim() || loading}
          className="px-3 py-1 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-xs font-medium rounded transition-all duration-150"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  );
}

export default function KanbanBoard({ tasks, onMoveTask, onAddTask, onSelectTask }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const grouped = COLUMNS.reduce<Record<TaskStatus, Task[]>>(
    (acc, col) => {
      acc[col.status] = tasks.filter((t) => t.status === col.status);
      return acc;
    },
    { backlog: [], plan: [], 'in-progress': [], done: [], blocked: [] },
  );

  const handleDrop = (status: TaskStatus) => {
    if (draggingId && onMoveTask) {
      onMoveTask(draggingId, status);
    }
    setDraggingId(null);
    setOverCol(null);
  };

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      {COLUMNS.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.status); }}
          onDragLeave={() => setOverCol(null)}
          onDrop={() => handleDrop(col.status)}
          className={`flex flex-col rounded-xl border transition-all duration-200 ${col.border} ${
            overCol === col.status ? 'bg-stone-800/60 scale-[1.01]' : 'bg-stone-900/40'
          }`}
        >
          {/* Column header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-800/60">
            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
            <span className="text-sm font-semibold text-stone-300">{col.label}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {col.status === 'backlog' && (() => {
                const reviewCount = grouped.backlog.filter(
                  (t) => t.planningPhase === 'functional-review' || t.planningPhase === 'technical-review'
                ).length;
                return reviewCount > 0 ? (
                  <span className="text-xs bg-amber-600 text-stone-950 font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center animate-scale-in">
                    {reviewCount}
                  </span>
                ) : null;
              })()}
              <span className="text-xs bg-stone-800 text-stone-400 rounded-full px-2 py-0.5">
                {grouped[col.status].length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
            {grouped[col.status].length === 0 && !(col.status === 'backlog' && onAddTask) && (
              <div className="text-xs text-stone-700 text-center py-8 italic">Empty</div>
            )}
            {grouped[col.status].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDragStart={setDraggingId}
                onClick={onSelectTask ? () => onSelectTask(task.id) : undefined}
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
