import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentInfo, AppStatus, FileLock, HumanQueueItem, LogEntry, Task, TaskStatus, WsMessage } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import KanbanBoard from './components/KanbanBoard';
import AgentCards from './components/AgentCards';
import FileLocks from './components/FileLocks';
import OrchestratorPlan from './components/OrchestratorPlan';
import LogStream from './components/LogStream';
import HumanQueue from './components/HumanQueue';
import Controls from './components/Controls';

type Tab = 'kanban' | 'agents' | 'logs' | 'locks' | 'plan' | 'queue' | 'controls';

/* ── SVG tab icons (monochrome, inherit currentColor) ── */
const TabIcon = ({ id }: { id: Tab }) => {
  const cls = "w-4 h-4";
  switch (id) {
    case 'kanban':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="12" rx="1.5" /></svg>;
    case 'agents':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>;
    case 'logs':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M4 6h16M4 10h16M4 14h10M4 18h7" /></svg>;
    case 'locks':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 118 0v4" /></svg>;
    case 'plan':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
    case 'queue':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'controls':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>;
  }
};

const MAX_LOGS = 2000;

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [locks, setLocks] = useState<FileLock[]>([]);
  const [plan, setPlan] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [humanQueue, setHumanQueue] = useState<HumanQueueItem[]>([]);
  const [status, setStatus] = useState<AppStatus>({ paused: false, projectRoot: '' });
  const [queueBadge, setQueueBadge] = useState(0);
  const initialLoadRef = useRef(false);

  // ── REST helpers ────────────────────────────────────────────────────────────
  const fetchJson = async <T,>(url: string): Promise<T> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  };

  const appendLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  // ── WebSocket handler ────────────────────────────────────────────────────────
  const handleMessage = useCallback(
    (msg: WsMessage) => {
      const ts = new Date().toISOString();

      switch (msg.type) {
        case 'connected':
          appendLog({ timestamp: ts, agent: 'system', level: 'info', message: `Connected — projectRoot: ${String(msg.projectRoot)}` });
          break;

        case 'task-created': {
          const task = msg.task as Task;
          setTasks((prev) => [...prev.filter((t) => t.id !== task.id), task]);
          appendLog({ timestamp: ts, agent: 'system', level: 'info', message: `Task created: ${task.title} (${task.id})` });
          break;
        }

        case 'task-assigned': {
          const taskId = String(msg.taskId ?? '');
          const agent = String(msg.agent ?? '');
          setTasks((prev) =>
            prev.map((t) => t.id === taskId ? { ...t, status: 'in-progress', agent } : t),
          );
          setAgents((prev) =>
            prev.map((a) => a.name === agent ? { ...a, status: 'working', currentTaskId: taskId } : a),
          );
          appendLog({ timestamp: ts, agent, level: 'info', message: `Assigned task ${taskId}` });
          break;
        }

        case 'task-completed': {
          const taskId = String(msg.taskId ?? '');
          const agent = String(msg.agent ?? '');
          setTasks((prev) =>
            prev.map((t) => t.id === taskId ? { ...t, status: 'done', completedAt: ts } : t),
          );
          setAgents((prev) =>
            prev.map((a) => a.name === agent ? { ...a, status: 'idle', currentTaskId: undefined } : a),
          );
          void fetchJson<FileLock[]>('/api/locks').then(setLocks).catch(() => null);
          appendLog({ timestamp: ts, agent, level: 'info', message: `Completed task ${taskId}` });
          break;
        }

        case 'task-blocked': {
          const taskId = String(msg.taskId ?? '');
          const reason = String(msg.summary ?? '');
          setTasks((prev) =>
            prev.map((t) => t.id === taskId ? { ...t, status: 'blocked', blockedReason: reason } : t),
          );
          appendLog({ timestamp: ts, agent: String(msg.agent ?? 'system'), level: 'warn', message: `Task blocked (${taskId}): ${reason}` });
          break;
        }

        case 'agent-error': {
          const agent = String(msg.agent ?? 'unknown');
          setAgents((prev) =>
            prev.map((a) => a.name === agent ? { ...a, status: 'idle', currentTaskId: undefined } : a),
          );
          appendLog({ timestamp: ts, agent, level: 'error', message: String(msg.summary ?? 'Agent error') });
          void fetchJson<HumanQueueItem[]>('/api/human-queue').then((items) => {
            setHumanQueue(items);
            setQueueBadge(items.filter((i) => !i.resolvedAt).length);
          }).catch(() => null);
          break;
        }

        case 'human-queue-resolved': {
          const id = String(msg.id ?? '');
          setHumanQueue((prev) =>
            prev.map((i) =>
              i.id === id ? { ...i, resolvedAt: ts, resolution: String(msg.resolution ?? '') } : i,
            ),
          );
          setQueueBadge((b) => Math.max(0, b - 1));
          appendLog({ timestamp: ts, agent: 'system', level: 'info', message: `Human queue item resolved: ${id}` });
          break;
        }

        case 'new-objective':
          appendLog({ timestamp: ts, agent: 'system', level: 'info', message: `New objective: ${String(msg.objective ?? '')}` });
          break;

        case 'objective-decomposed':
          appendLog({ timestamp: ts, agent: 'system', level: 'info', message: 'Objective decomposed into tasks' });
          void fetchJson<Task[]>('/api/tasks').then(setTasks).catch(() => null);
          void fetchJson<string>('/api/plan').then(setPlan).catch(() => null);
          break;

        default:
          appendLog({ timestamp: ts, agent: 'system', level: 'debug', message: `WS event: ${msg.type}` });
      }
    },
    [appendLog],
  );

  const { connected } = useWebSocket(handleMessage);

  // ── Initial data load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    void Promise.all([
      fetchJson<Task[]>('/api/tasks').then(setTasks).catch(() => null),
      fetchJson<AgentInfo[]>('/api/agents').then(setAgents).catch(() => null),
      fetchJson<FileLock[]>('/api/locks').then(setLocks).catch(() => null),
      fetchJson<string>('/api/plan').then(setPlan).catch(() => null),
      fetchJson<HumanQueueItem[]>('/api/human-queue').then((items) => {
        setHumanQueue(items);
        setQueueBadge(items.filter((i) => !i.resolvedAt).length);
      }).catch(() => null),
      fetchJson<AppStatus>('/api/status').then(setStatus).catch(() => null),
      fetchJson<LogEntry[]>('/api/logs').then((entries) => {
        setLogs((prev) => [...entries, ...prev].slice(-MAX_LOGS));
      }).catch(() => null),
    ]);
  }, []);

  // ── Periodic refresh for agents and locks ───────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      void fetchJson<AgentInfo[]>('/api/agents').then(setAgents).catch(() => null);
      void fetchJson<FileLock[]>('/api/locks').then(setLocks).catch(() => null);
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  // ── Action handlers ──────────────────────────────────────────────────────────
  const handleMoveTask = async (taskId: string, newStatus: TaskStatus) => {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t),
    );
  };

  const handleResolve = async (id: string, resolution: string) => {
    const r = await fetch(`/api/human-queue/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    if (!r.ok) throw new Error('Failed');
    const updated = (await r.json()) as HumanQueueItem;
    setHumanQueue((prev) => prev.map((i) => i.id === id ? updated : i));
    setQueueBadge((b) => Math.max(0, b - 1));
  };

  const handleAddTask = async (task: { title: string; description: string; acceptanceCriteria: string[] }) => {
    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || 'Unexpected server error');
    }
    // Task will be added via the WebSocket 'task-created' event — no optimistic insert
    // to avoid the duplication bug caused by both REST response and WS adding the same task.
    await r.json();
  };

  const handleNewObjective = async (objective: string) => {
    const r = await fetch('/api/objective', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective }),
    });
    if (!r.ok) throw new Error('Failed');
  };

  const handlePause = async () => {
    await fetch('/api/pause', { method: 'POST' });
    setStatus((s) => ({ ...s, paused: true }));
  };

  const handleResume = async () => {
    await fetch('/api/resume', { method: 'POST' });
    setStatus((s) => ({ ...s, paused: false }));
  };

  const handleToggleAgent = async (name: string, enabled: boolean) => {
    const r = await fetch(`/api/agents/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) throw new Error('Failed');
    setAgents((prev) => prev.map((a) => a.name === name ? { ...a, enabled } : a));
  };

  const handleCreateAgent = async (agent: { name: string; role: string; runner: string; systemPrompt: string }) => {
    const r = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    if (!r.ok) throw new Error('Failed');
    const newAgent = (await r.json()) as AgentInfo;
    setAgents((prev) => [...prev, { ...newAgent, status: 'idle' as const }]);
  };

  const handleDeleteAgent = async (name: string) => {
    const r = await fetch(`/api/agents/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Failed');
    setAgents((prev) => prev.filter((a) => a.name !== name));
  };

  const agentNames = agents.map((a) => a.name);
  const pendingQueue = humanQueue.filter((i) => !i.resolvedAt).length;

  const TABS: Tab[] = ['kanban', 'agents', 'logs', 'locks', 'plan', 'queue', 'controls'];
  const TAB_LABELS: Record<Tab, string> = {
    kanban: 'Kanban', agents: 'Agents', logs: 'Logs', locks: 'Locks',
    plan: 'Plan', queue: 'Queue', controls: 'Controls',
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex-none bg-stone-900 border-b border-stone-800 px-5 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
          <span className="text-lg font-bold text-stone-100 tracking-tight">Maestro</span>
          {status.projectRoot && (
            <span className="text-xs text-stone-500 font-mono truncate max-w-48 hidden sm:block">
              {status.projectRoot}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {status.paused && (
            <span className="text-xs bg-amber-950/60 text-amber-400 border border-amber-800/40 rounded-full px-2.5 py-0.5 font-medium animate-pulse-soft">
              Paused
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-emerald-500 animate-pulse-soft' : 'bg-red-500'}`} />
            <span className={connected ? 'text-stone-400' : 'text-red-400'}>
              {connected ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <nav className="flex-none bg-stone-900/80 border-b border-stone-800 px-4 overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          {TABS.map((tabId) => {
            const badge = tabId === 'queue' && queueBadge > 0 ? queueBadge : null;
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-150 ${
                  active
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-800/40'
                }`}
              >
                <TabIcon id={tabId} />
                {TAB_LABELS[tabId]}
                {badge !== null && (
                  <span className="ml-1 bg-amber-600 text-stone-950 text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center inline-block animate-scale-in">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="flex-1 overflow-hidden p-4 min-h-0">
        <div className="h-full overflow-y-auto">
          {activeTab === 'kanban' && (
            <div className="h-full min-h-[500px] animate-fade-in">
              <KanbanBoard tasks={tasks} onMoveTask={handleMoveTask} onAddTask={handleAddTask} />
            </div>
          )}
          {activeTab === 'agents' && (
            <div className="animate-fade-in">
              <AgentCards
                agents={agents}
                tasks={tasks}
                onToggleAgent={handleToggleAgent}
                onCreateAgent={handleCreateAgent}
                onDeleteAgent={handleDeleteAgent}
              />
            </div>
          )}
          {activeTab === 'logs' && (
            <div className="h-full min-h-[500px] flex flex-col animate-fade-in">
              <LogStream logs={logs} agents={agentNames} />
            </div>
          )}
          {activeTab === 'locks' && <div className="animate-fade-in"><FileLocks locks={locks} tasks={tasks} /></div>}
          {activeTab === 'plan' && <div className="animate-fade-in"><OrchestratorPlan plan={plan} /></div>}
          {activeTab === 'queue' && (
            <div className="animate-fade-in">
              <HumanQueue
                items={humanQueue}
                onResolve={handleResolve}
              />
            </div>
          )}
          {activeTab === 'controls' && (
            <div className="animate-fade-in">
              <Controls
                paused={status.paused}
                onPause={handlePause}
                onResume={handleResume}
                onAddTask={handleAddTask}
                onNewObjective={handleNewObjective}
              />
            </div>
          )}
        </div>
      </main>

      {/* ── Status bar ── */}
      {pendingQueue > 0 && activeTab !== 'queue' && (
        <div
          className="flex-none bg-amber-950/40 border-t border-amber-900/40 px-4 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-amber-950/60 transition-colors animate-slide-in-up"
          onClick={() => setActiveTab('queue')}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-soft" />
          <span className="text-xs text-amber-400 font-medium">
            {pendingQueue} item{pendingQueue > 1 ? 's' : ''} need{pendingQueue === 1 ? 's' : ''} your attention
          </span>
          <span className="ml-auto text-xs text-amber-500/70">View queue &rarr;</span>
        </div>
      )}
    </div>
  );
}
