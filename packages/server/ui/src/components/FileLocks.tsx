import type { FileLock, Task } from '../types';

interface Props {
  locks: FileLock[];
  tasks: Task[];
}

export default function FileLocks({ locks, tasks }: Props) {
  if (locks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-stone-600">
        <svg className="w-10 h-10 mb-2 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
        <span className="italic text-sm">No file locks active</span>
      </div>
    );
  }

  // Group by agent
  const byAgent = locks.reduce<Record<string, FileLock[]>>((acc, lock) => {
    (acc[lock.agent] ??= []).push(lock);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-800">
              <th className="text-left py-2 px-3 text-stone-500 font-medium">File</th>
              <th className="text-left py-2 px-3 text-stone-500 font-medium">Agent</th>
              <th className="text-left py-2 px-3 text-stone-500 font-medium">Task</th>
            </tr>
          </thead>
          <tbody>
            {locks.map((lock, i) => {
              const task = tasks.find((t) => t.id === lock.taskId);
              return (
                <tr
                  key={`${lock.agent}-${lock.file}-${i}`}
                  className="border-b border-stone-800/50 hover:bg-stone-800/40 transition-colors"
                >
                  <td className="py-2 px-3 font-mono text-amber-500/80 text-xs">{lock.file}</td>
                  <td className="py-2 px-3">
                    <span className="bg-amber-950/40 text-amber-400 rounded px-2 py-0.5 text-xs">
                      @{lock.agent}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-stone-400 text-xs">
                    {task ? task.title : <span className="text-stone-600 font-mono">{lock.taskId}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-agent grouping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(byAgent).map(([agent, agentLocks]) => (
          <div key={agent} className="bg-stone-800/60 border border-stone-700/60 rounded-xl p-4 hover:border-stone-600 transition-all duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold text-amber-400">@{agent}</span>
              <span className="ml-auto text-xs bg-stone-800 rounded-full px-2 py-0.5 text-stone-400">
                {agentLocks.length} {agentLocks.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <ul className="space-y-1">
              {agentLocks.map((lock, i) => (
                <li key={i} className="font-mono text-xs text-amber-500/70 truncate" title={lock.file}>
                  {lock.file}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
