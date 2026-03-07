import type { AgentInfo, Task } from '../types';

interface Props {
  agents: AgentInfo[];
  tasks: Task[];
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

function AgentCard({ agent, currentTask }: { agent: AgentInfo; currentTask?: Task }) {
  const cfg = STATUS_CONFIG[agent.status];

  return (
    <div className={`bg-slate-800/80 border border-slate-700 rounded-xl p-4 ring-1 ${cfg.ring} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-100 text-base">{agent.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{agent.role || 'Unknown role'}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {agent.runner && (
        <div className="text-xs text-slate-500 mb-3">
          Runner: <span className="text-slate-400">{agent.runner}</span>
          {agent.model && <span className="ml-2 text-slate-500">{agent.model}</span>}
        </div>
      )}

      {currentTask ? (
        <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Current task</div>
          <div className="text-sm text-slate-200 leading-snug">{currentTask.title}</div>
          <div className="text-xs text-slate-500 mt-1 font-mono">{currentTask.id}</div>
          {currentTask.filesLocked && currentTask.filesLocked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {currentTask.filesLocked.map((f) => (
                <span key={f} className="text-xs bg-amber-900/40 text-amber-400 rounded px-1.5 py-0.5 font-mono truncate max-w-[150px]">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-600 italic">No active task</div>
      )}

      {agent.lastActiveAt && (
        <div className="text-xs text-slate-600 mt-3">
          Last active: {new Date(agent.lastActiveAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default function AgentCards({ agents, tasks }: Props) {
  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 italic">
        No agents configured yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {agents.map((agent) => {
        const currentTask = agent.currentTaskId
          ? tasks.find((t) => t.id === agent.currentTaskId)
          : undefined;
        return <AgentCard key={agent.name} agent={agent} currentTask={currentTask} />;
      })}
    </div>
  );
}
