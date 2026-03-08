import { useState } from 'react';

interface Props {
  paused: boolean;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onAddTask: (task: { title: string; description: string; acceptanceCriteria: string[] }) => Promise<void>;
  onNewObjective: (objective: string) => Promise<void>;
}

export default function Controls({ paused, onPause, onResume, onAddTask, onNewObjective }: Props) {
  const [pauseLoading, setPauseLoading] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', criteria: '' });
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskSuccess, setTaskSuccess] = useState('');
  const [taskError, setTaskError] = useState('');
  const [objective, setObjective] = useState('');
  const [objLoading, setObjLoading] = useState(false);
  const [objSuccess, setObjSuccess] = useState('');
  const [objError, setObjError] = useState('');

  const handlePauseToggle = async () => {
    setPauseLoading(true);
    try {
      paused ? await onResume() : await onPause();
    } finally {
      setPauseLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !taskForm.description.trim()) return;
    setTaskLoading(true);
    setTaskError('');
    setTaskSuccess('');
    try {
      const acceptanceCriteria = taskForm.criteria
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      await onAddTask({ title: taskForm.title.trim(), description: taskForm.description.trim(), acceptanceCriteria });
      setTaskSuccess('Task added to backlog');
      setTaskForm({ title: '', description: '', criteria: '' });
      setTimeout(() => setTaskSuccess(''), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setTaskError(`Unable to add task: ${message}`);
    } finally {
      setTaskLoading(false);
    }
  };

  const handleNewObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim()) return;
    setObjLoading(true);
    setObjError('');
    setObjSuccess('');
    try {
      await onNewObjective(objective.trim());
      setObjSuccess('Objective submitted');
      setObjective('');
      setTimeout(() => setObjSuccess(''), 3000);
    } catch {
      setObjError('Failed to submit objective.');
    } finally {
      setObjLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8">
      {/* Orchestrator controls */}
      <section className="bg-stone-800/60 border border-stone-700/60 rounded-xl p-5">
        <h3 className="text-base font-semibold text-stone-100 mb-4">Orchestrator</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm text-stone-500 mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse-soft'}`}
              />
              <span className={`font-semibold ${paused ? 'text-amber-400' : 'text-emerald-400'}`}>
                {paused ? 'Paused' : 'Running'}
              </span>
            </div>
          </div>
          <button
            onClick={handlePauseToggle}
            disabled={pauseLoading}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
              paused
                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'bg-amber-700 hover:bg-amber-600 text-white'
            } disabled:opacity-50`}
          >
            {pauseLoading ? '...' : paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </section>

      {/* New objective */}
      <section className="bg-stone-800/60 border border-stone-700/60 rounded-xl p-5">
        <h3 className="text-base font-semibold text-stone-100 mb-4">Submit Objective</h3>
        <form onSubmit={handleNewObjective} className="space-y-3">
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Describe a high-level objective for the orchestrator to decompose into tasks..."
            rows={3}
            className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none transition-all duration-150"
          />
          {objError && <div className="text-xs text-red-400 animate-fade-in">{objError}</div>}
          {objSuccess && <div className="text-xs text-emerald-400 animate-fade-in">{objSuccess}</div>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!objective.trim() || objLoading}
              className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              {objLoading ? 'Submitting...' : 'Submit objective'}
            </button>
          </div>
        </form>
      </section>

      {/* Add task manually */}
      <section className="bg-stone-800/60 border border-stone-700/60 rounded-xl p-5">
        <h3 className="text-base font-semibold text-stone-100 mb-4">Add Task Manually</h3>
        <form onSubmit={handleAddTask} className="space-y-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Title *</label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title"
              className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 transition-all duration-150"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Description *</label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detailed description of what needs to be done..."
              rows={3}
              className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none transition-all duration-150"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">
              Acceptance criteria <span className="text-stone-700">(one per line, optional)</span>
            </label>
            <textarea
              value={taskForm.criteria}
              onChange={(e) => setTaskForm((f) => ({ ...f, criteria: e.target.value }))}
              placeholder="The feature passes all unit tests&#10;The UI renders correctly on mobile"
              rows={3}
              className="w-full bg-stone-900/70 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none font-mono transition-all duration-150"
            />
          </div>
          {taskError && <div className="text-xs text-red-400 animate-fade-in">{taskError}</div>}
          {taskSuccess && <div className="text-xs text-emerald-400 animate-fade-in">{taskSuccess}</div>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!taskForm.title.trim() || !taskForm.description.trim() || taskLoading}
              className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              {taskLoading ? 'Adding...' : 'Add to backlog'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
