import { useState } from 'react';
import type { HumanQueueItem } from '../types';

interface Props {
  items: HumanQueueItem[];
  onResolve: (id: string, resolution: string) => Promise<void>;
}

const TYPE_CONFIG = {
  conflict: { label: 'Conflict',  color: 'bg-red-950/50 text-red-400 border-red-900/50' },
  decision: { label: 'Decision',  color: 'bg-amber-950/50 text-amber-400 border-amber-900/50' },
  error:    { label: 'Error',     color: 'bg-orange-950/50 text-orange-400 border-orange-900/50' },
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
    <div className={`border rounded-xl overflow-hidden transition-opacity duration-200 ${isResolved ? 'opacity-50' : ''} ${cfg.color} animate-fade-in`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color} whitespace-nowrap`}>
          {cfg.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-100">{item.title}</div>
          <div className="text-xs text-stone-500 mt-0.5">
            {new Date(item.createdAt).toLocaleString()}
            {isResolved && item.resolvedAt && (
              <span className="ml-2 text-emerald-500">
                Resolved {new Date(item.resolvedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 space-y-3">
        <p className="text-sm text-stone-300 leading-relaxed">{item.description}</p>

        {item.context && Object.keys(item.context).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-stone-500 hover:text-stone-300 transition-colors">Context</summary>
            <pre className="mt-2 bg-stone-900/60 rounded-lg p-3 text-stone-400 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(item.context, null, 2)}
            </pre>
          </details>
        )}

        {isResolved ? (
          <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-3 py-2">
            <div className="text-xs text-emerald-500 font-medium mb-0.5">Resolution</div>
            <div className="text-sm text-stone-200">{item.resolution}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Type your resolution or decision here..."
              rows={3}
              className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none transition-all duration-150"
            />
            {error && <div className="text-xs text-red-400 animate-fade-in">{error}</div>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!resolution.trim() || submitting}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
              >
                {submitting ? 'Submitting...' : 'Submit resolution'}
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
      <div className="flex flex-col items-center justify-center h-48 text-stone-600">
        <svg className="w-10 h-10 mb-2 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-soft" />
            <h3 className="text-sm font-semibold text-stone-300">
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
          <summary className="cursor-pointer text-sm text-stone-500 hover:text-stone-300 mb-3 transition-colors">
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
