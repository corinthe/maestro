import { useState, useRef, useEffect } from 'react';
import type { AgentInfo, AgentOutput, Task } from '../types';

interface Props {
  agents: AgentInfo[];
  tasks: Task[];
  agentOutputs: Record<string, AgentOutput>;
  onToggleAgent: (name: string, enabled: boolean) => Promise<void>;
  onCreateAgent: (agent: { name: string; role: string; runner: string; systemPrompt: string }) => Promise<void>;
  onDeleteAgent: (name: string) => Promise<void>;
}

const STATUS_CONFIG = {
  idle: {
    label: 'Idle',
    dot: 'bg-stone-500',
    badge: 'bg-stone-800 text-stone-400',
    ring: 'ring-stone-700/50',
  },
  working: {
    label: 'Working',
    dot: 'bg-amber-500 animate-pulse-soft',
    badge: 'bg-amber-950/60 text-amber-400',
    ring: 'ring-amber-700/30',
  },
  waiting: {
    label: 'Waiting',
    dot: 'bg-orange-400',
    badge: 'bg-orange-950/60 text-orange-400',
    ring: 'ring-orange-700/30',
  },
};

function LiveOutput({ output }: { output: AgentOutput }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output.chunks.length, expanded]);

  if (output.chunks.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors mb-1"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
        Live output
        <span className="text-stone-600">({output.chunks.length} chunks)</span>
      </button>
      {expanded && (
        <div
          ref={scrollRef}
          className="bg-stone-950 border border-stone-800 rounded-lg p-3 max-h-[200px] overflow-y-auto font-mono text-xs leading-relaxed"
        >
          {output.chunks.map((chunk, i) => (
            <span
              key={i}
              className={chunk.stream === 'stderr' ? 'text-orange-400' : 'text-stone-300'}
            >
              {chunk.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  currentTask,
  output,
  onToggle,
  onDelete,
}: {
  agent: AgentInfo;
  currentTask?: Task;
  output?: AgentOutput;
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
      className={`bg-stone-800/80 border border-stone-700/60 rounded-xl p-4 ring-1 ${cfg.ring} transition-all duration-200 hover:border-stone-600 ${
        !enabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-100 text-base">{agent.name}</div>
          <div className="text-xs text-stone-500 mt-0.5">{agent.role || 'Unknown role'}</div>
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-800 text-stone-600">
              Disabled
            </span>
          )}
        </div>
      </div>

      {agent.runner && (
        <div className="text-xs text-stone-600 mb-3">
          Runner: <span className="text-stone-400">{agent.runner}</span>
          {agent.model && <span className="ml-2 text-stone-500">{agent.model}</span>}
        </div>
      )}

      {enabled && currentTask ? (
        <div className="bg-stone-900/60 rounded-lg p-3 border border-stone-700/40">
          <div className="text-xs text-stone-500 mb-1 font-medium uppercase tracking-wide">Current task</div>
          <div className="text-sm text-stone-200 leading-snug">{currentTask.title}</div>
          <div className="text-xs text-stone-600 mt-1 font-mono">{currentTask.id}</div>
          {currentTask.filesLocked && currentTask.filesLocked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {currentTask.filesLocked.map((f) => (
                <span
                  key={f}
                  className="text-xs bg-amber-950/40 text-amber-400/80 rounded px-1.5 py-0.5 font-mono truncate max-w-[150px]"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : enabled ? (
        <div className="text-xs text-stone-600 italic">No active task</div>
      ) : null}

      {/* Live output panel */}
      {enabled && output && output.chunks.length > 0 && (
        <LiveOutput output={output} />
      )}

      {agent.lastActiveAt && (
        <div className="text-xs text-stone-600 mt-3">
          Last active: {new Date(agent.lastActiveAt).toLocaleTimeString()}
        </div>
      )}

      {/* Controls: toggle + delete */}
      <div className="mt-3 pt-3 border-t border-stone-700/40 flex items-center justify-between">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
            enabled ? 'bg-emerald-700' : 'bg-stone-700'
          } disabled:opacity-50`}
          title={enabled ? 'Disable agent' : 'Enable agent'}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>

        {!showConfirmDelete ? (
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="text-xs text-stone-600 hover:text-red-400 transition-colors"
            title="Delete agent"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 animate-fade-in">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
            >
              {deleting ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-xs text-stone-500 hover:text-stone-300"
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
        className="w-full bg-stone-800/40 border border-dashed border-stone-700 rounded-xl p-4 text-sm text-stone-500 hover:text-stone-300 hover:border-stone-600 transition-all duration-150"
      >
        + Create new agent
      </button>
    );
  }

  return (
    <div className="bg-stone-800/80 border border-stone-700 rounded-xl p-4 animate-scale-in">
      <h4 className="text-sm font-semibold text-stone-100 mb-3">New Agent</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. devops"
              className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 transition-all duration-150"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Role *</label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="e.g. DevOps engineer"
              className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 transition-all duration-150"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Runner</label>
          <input
            type="text"
            value={form.runner}
            onChange={(e) => setForm((f) => ({ ...f, runner: e.target.value }))}
            className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 transition-all duration-150"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">System prompt</label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
            placeholder="Describe the agent's role and behavior..."
            rows={3}
            className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none transition-all duration-150"
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
            className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || !form.role.trim() || loading}
            className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
          >
            {loading ? 'Creating...' : 'Create agent'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AgentCards({ agents, tasks, agentOutputs, onToggleAgent, onCreateAgent, onDeleteAgent }: Props) {
  return (
    <div className="space-y-4">
      {agents.length === 0 && (
        <div className="flex items-center justify-center h-32 text-stone-600 italic">
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
              output={agentOutputs[agent.name]}
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
