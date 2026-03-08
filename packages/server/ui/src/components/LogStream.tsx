import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  agents: string[];
}

const LEVEL_STYLES: Record<string, string> = {
  info:  'text-stone-300',
  debug: 'text-stone-600',
  warn:  'text-amber-400',
  error: 'text-red-400',
};

const LEVEL_BADGE: Record<string, string> = {
  info:  'bg-stone-800 text-stone-400',
  debug: 'bg-stone-900 text-stone-600',
  warn:  'bg-amber-950/60 text-amber-400',
  error: 'bg-red-950/60 text-red-400',
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
          <label className="text-xs text-stone-500">Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-sm text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-600/50 transition-all duration-150"
          >
            <option value="all">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>@{a}</option>
            ))}
            <option value="system">system</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500">Level</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-sm text-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-600/50 transition-all duration-150"
          >
            <option value="all">All levels</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-stone-600">{filtered.length} entries</span>
          <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-amber-600"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Log output */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-stone-900 rounded-xl border border-stone-800 font-mono text-xs min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-700 italic">
            No log entries
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {filtered.map((log, i) => (
                <tr
                  key={i}
                  className="border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors"
                >
                  <td className="px-3 py-1 text-stone-600 whitespace-nowrap w-36">
                    {new Date(log.timestamp).toLocaleTimeString('en', { hour12: false })}
                  </td>
                  <td className="px-2 py-1 w-24">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${LEVEL_BADGE[log.level] ?? LEVEL_BADGE.info}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-2 py-1 w-28 text-amber-500/80 truncate">
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
