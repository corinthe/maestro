import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  agents: string[];
}

const LEVEL_STYLES: Record<string, string> = {
  info:  'text-slate-300',
  debug: 'text-slate-500',
  warn:  'text-amber-400',
  error: 'text-red-400',
};

const LEVEL_BADGE: Record<string, string> = {
  info:  'bg-slate-700 text-slate-300',
  debug: 'bg-slate-800 text-slate-500',
  warn:  'bg-amber-900/60 text-amber-300',
  error: 'bg-red-900/60 text-red-300',
};

export default function LogStream({ logs, agents }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = logs.filter((log) => {
    if (selectedAgent !== 'all' && log.agent !== selectedAgent) return false;
    if (selectedLevel !== 'all' && log.level !== selectedLevel) return false;
    return true;
  });

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filtered.length, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>@{a}</option>
            ))}
            <option value="system">system</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Level</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All levels</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{filtered.length} entries</span>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-blue-500"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-slate-900 rounded-xl border border-slate-700 font-mono text-xs min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 italic">
            No log entries
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {filtered.map((log, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-3 py-1 text-slate-600 whitespace-nowrap w-36">
                    {new Date(log.timestamp).toLocaleTimeString('en', { hour12: false })}
                  </td>
                  <td className="px-2 py-1 w-24">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${LEVEL_BADGE[log.level] ?? LEVEL_BADGE.info}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-2 py-1 w-28 text-blue-400 truncate">
                    {log.agent !== 'system' ? `@${log.agent}` : 'system'}
                  </td>
                  <td className={`px-2 py-1 ${LEVEL_STYLES[log.level] ?? ''} break-all`}>
                    {log.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
