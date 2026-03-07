import { useState } from 'react';
import type { AgentInfo, Task } from '../types';

interface Props {
  agents: AgentInfo[];
  tasks: Task[];
  onToggleAgent: (name: string, enabled: boolean) => Promise<void>;
  onCreateAgent: (agent: { name: string; role: string; runner: string; systemPrompt: string }) => Promise<void>;
  onDeleteAgent: (name: string) => Promise<void>;
}

const STATUS_CONFIG = {
  idle: {
    label: 'Idle',
    dot: 'bg-slate-400',
    badge: 'bg-slate-700 text-slate-300',
    ring: 'ring-slate-600',
  },
  working: {
    label: 'Working',
    dot: 'bg-blue-400 animate-pulse',
    badge: 'bg-blue-900/60 text-blue-300',
    ring: 'ring-blue-500/50',
  },
  waiting: {
    label: 'Waiting',
    dot: 'bg-amber-400',
    badge: 'bg-amber-900/60 text-amber-300',
    ring: 'ring-amber-500/50',
  },
};

function AgentCard({
  agent,
  currentTask,
  onToggle,
  onDelete,
}: {
  agent: AgentInfo;
  currentTask?: Task;
  onToggle: (name: string, enabled: boolean) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const enabled = agent.enabled !== false;
  const cfg = STATUS_CONFIG[agent.status];

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggle(agent.name, !enabled);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(agent.name);
    } finally {
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div
      className={`bg-slate-800/80 border border-slate-700 rounded-xl p-4 ring-1 ${cfg.ring} transition-all ${
        !enabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-100 text-base">{agent.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{agent.role || 'Unknown role'}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {enabled && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          )}
          {!enabled && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500">
              Disabled
            </span>
          )}
        </div>
      </div>

      {agent.runner && (
        <div className="text-xs text-slate-500 mb-3">
          Runner: <span className="text-slate-400">{agent.runner}</span>
          {agent.model && <span className="ml-2 text-slate-500">{agent.model}</span>}
        </div>
      )}

      {enabled && currentTask ? (
        <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Current task</div>
          <div className="text-sm text-slate-200 leading-snug">{currentTask.title}</div>
          <div className="text-xs text-slate-500 mt-1 font-mono">{currentTask.id}</div>
          {currentTask.filesLocked && currentTask.filesLocked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {currentTask.filesLocked.map((f) => (
                <span
                  key={f}
                  className="text-xs bg-amber-900/40 text-amber-400 rounded px-1.5 py-0.5 font-mono truncate max-w-[150px]"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : enabled ? (
        <div className="text-xs text-slate-600 italic">No active task</div>
      ) : null}

      {agent.lastActiveAt && (
        <div className="text-xs text-slate-600 mt-3">
          Last active: {new Date(agent.lastActiveAt).toLocaleTimeString()}
        </div>
      )}

      {/* Controls: toggle + delete */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-emerald-600' : 'bg-slate-600'
          } disabled:opacity-50`}
          title={enabled ? 'Disable agent' : 'Enable agent'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>

        {!showConfirmDelete ? (
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            title="Delete agent"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
            >
              {deleting ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAgentForm({ onCreate }: { onCreate: Props['onCreateAgent'] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', runner: 'claude-code', systemPrompt: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.role.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate({
        name: form.name.trim(),
        role: form.role.trim(),
        runner: form.runner.trim() || 'claude-code',
        systemPrompt: form.systemPrompt.trim(),
      });
      setForm({ name: '', role: '', runner: 'claude-code', systemPrompt: '' });
      setOpen(false);
    } catch {
      setError('Failed to create agent.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-slate-800/40 border border-dashed border-slate-600 rounded-xl p-4 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
      >
        + Create new agent
      </button>
    );
  }

  return (
    <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-slate-100 mb-3">New Agent</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. devops"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role *</label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="e.g. DevOps engineer"
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Runner</label>
          <input
            type="text"
            value={form.runner}
            onChange={(e) => setForm((f) => ({ ...f, runner: e.target.value }))}
            className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">System prompt</label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
            placeholder="Describe the agent's role and behavior..."
            rows={3}
            className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError('');
            }}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || !form.role.trim() || loading}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Create agent'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AgentCards({ agents, tasks, onToggleAgent, onCreateAgent, onDeleteAgent }: Props) {
  return (
    <div className="space-y-4">
      {agents.length === 0 && (
        <div className="flex items-center justify-center h-32 text-slate-500 italic">
          No agents configured yet. Create one below.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => {
          const currentTask = agent.currentTaskId
            ? tasks.find((t) => t.id === agent.currentTaskId)
            : undefined;
          return (
            <AgentCard
              key={agent.name}
              agent={agent}
              currentTask={currentTask}
              onToggle={onToggleAgent}
              onDelete={onDeleteAgent}
            />
          );
        })}
      </div>

      <CreateAgentForm onCreate={onCreateAgent} />
    </div>
  );
}
