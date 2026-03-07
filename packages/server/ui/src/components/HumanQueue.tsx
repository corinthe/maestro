import { useState } from 'react';
import type { HumanQueueItem } from '../types';

interface Props {
  items: HumanQueueItem[];
  onResolve: (id: string, resolution: string) => Promise<void>;
}

const TYPE_CONFIG = {
  conflict: { label: 'Conflict',  color: 'bg-red-900/50 text-red-300 border-red-700/50' },
  decision: { label: 'Decision',  color: 'bg-amber-900/50 text-amber-300 border-amber-700/50' },
  error:    { label: 'Error',     color: 'bg-orange-900/50 text-orange-300 border-orange-700/50' },
};

function QueueItemCard({
  item,
  onResolve,
}: {
  item: HumanQueueItem;
  onResolve: (id: string, resolution: string) => Promise<void>;
}) {
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.decision;
  const isResolved = Boolean(item.resolvedAt);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolution.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onResolve(item.id, resolution.trim());
    } catch {
      setError('Failed to submit resolution. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${isResolved ? 'opacity-60' : ''} ${cfg.color}`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} whitespace-nowrap`}>
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-100">{item.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {new Date(item.createdAt).toLocaleString()}
            {isResolved && item.resolvedAt && (
              <span className="ml-2 text-emerald-400">
                ✓ Resolved {new Date(item.resolvedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 space-y-3">
        <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>

        {item.context && Object.keys(item.context).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-400 hover:text-slate-200">Context</summary>
            <pre className="mt-2 bg-slate-900/60 rounded-lg p-3 text-slate-300 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(item.context, null, 2)}
            </pre>
          </details>
        )}

        {isResolved ? (
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg px-3 py-2">
            <div className="text-xs text-emerald-400 font-medium mb-0.5">Resolution</div>
            <div className="text-sm text-slate-200">{item.resolution}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Type your resolution or decision here…"
              rows={3}
              className="w-full bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            {error && <div className="text-xs text-red-400">{error}</div>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!resolution.trim() || submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit resolution'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function HumanQueue({ items, onResolve }: Props) {
  const pending = items.filter((i) => !i.resolvedAt);
  const resolved = items.filter((i) => i.resolvedAt);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <svg className="w-10 h-10 mb-2 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="italic text-sm">All clear — no items need attention</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {pending.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-slate-200">
              Needs attention ({pending.length})
            </h3>
          </div>
          {pending.map((item) => (
            <QueueItemCard key={item.id} item={item} onResolve={onResolve} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200 mb-3">
            Resolved ({resolved.length})
          </summary>
          <div className="space-y-3 mt-3">
            {resolved.map((item) => (
              <QueueItemCard key={item.id} item={item} onResolve={onResolve} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
