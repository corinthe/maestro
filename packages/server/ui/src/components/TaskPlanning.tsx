import { useCallback, useEffect, useState } from 'react';
import type { Task, TaskPlanData, PlanComment } from '../types';

interface Props {
  task: Task;
  onClose: () => void;
  onApprovePlan: (taskId: string, phase: 'functional' | 'technical') => Promise<void>;
  onRequestChanges: (taskId: string, phase: 'functional' | 'technical', comment: string) => Promise<void>;
  onAddComment: (taskId: string, phase: 'functional' | 'technical', content: string) => Promise<void>;
}

const STEPS = [
  { key: 'functional', label: 'Functional Plan' },
  { key: 'technical', label: 'Technical Plan' },
  { key: 'ready', label: 'Ready' },
] as const;

function getActiveStep(task: Task): number {
  switch (task.planningPhase) {
    case 'functional-planning':
    case 'functional-review':
      return 0;
    case 'technical-planning':
    case 'technical-review':
      return 1;
    case 'approved':
      return 2;
    default:
      return -1;
  }
}

function isReviewPhase(task: Task): boolean {
  return task.planningPhase === 'functional-review' || task.planningPhase === 'technical-review';
}

function isPlanningPhase(task: Task): boolean {
  return task.planningPhase === 'functional-planning' || task.planningPhase === 'technical-planning';
}

function getCurrentPhaseType(task: Task): 'functional' | 'technical' | null {
  if (!task.planningPhase) return null;
  if (task.planningPhase.startsWith('functional')) return 'functional';
  if (task.planningPhase.startsWith('technical')) return 'technical';
  return null;
}

export default function TaskPlanning({ task, onClose, onApprovePlan, onRequestChanges, onAddComment }: Props) {
  const [planData, setPlanData] = useState<TaskPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPlan = useCallback(async () => {
    try {
      const r = await fetch(`/api/tasks/${task.id}/plan`);
      if (r.ok) {
        const data = (await r.json()) as TaskPlanData;
        setPlanData(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [task.id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan, task.planningPhase]);

  const activeStep = getActiveStep(task);
  const phaseType = getCurrentPhaseType(task);
  const inReview = isReviewPhase(task);
  const inPlanning = isPlanningPhase(task);

  const currentPlanContent = phaseType === 'functional'
    ? (planData?.functionalPlan ?? '')
    : phaseType === 'technical'
      ? (planData?.technicalPlan ?? '')
      : '';

  const currentComments = (planData?.comments ?? []).filter((c: PlanComment) => c.phase === phaseType);

  const handleApprove = async () => {
    if (!phaseType) return;
    setSubmitting(true);
    setError('');
    try {
      await onApprovePlan(task.id, phaseType);
      setSuccess('Plan approved');
      setComment('');
      setTimeout(() => setSuccess(''), 3000);
      await fetchPlan();
    } catch {
      setError('Failed to approve plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!phaseType || !comment.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onRequestChanges(task.id, phaseType, comment.trim());
      setSuccess('Changes requested — agent will revise');
      setComment('');
      setTimeout(() => setSuccess(''), 3000);
      await fetchPlan();
    } catch {
      setError('Failed to request changes');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!phaseType || !comment.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onAddComment(task.id, phaseType, comment.trim());
      setComment('');
      await fetchPlan();
    } catch {
      setError('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-stone-900 border border-stone-700/60 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-stone-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-stone-100 truncate">{task.title}</h2>
            <p className="text-xs text-stone-500 mt-0.5 font-mono">{task.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-200 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-stone-800/60 bg-stone-900/50">
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isDone = i < activeStep;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : isActive
                          ? 'bg-amber-600 border-amber-600 text-white animate-pulse-soft'
                          : 'bg-stone-800 border-stone-700 text-stone-500'
                    }`}>
                      {isDone ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${
                      isActive ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-stone-600'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 rounded ${
                      isDone ? 'bg-emerald-700' : 'bg-stone-800'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-stone-600">
              <span className="animate-pulse">Loading plan data...</span>
            </div>
          ) : task.planningPhase === 'approved' ? (
            <div className="flex flex-col items-center justify-center h-32 text-emerald-500">
              <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Planning complete</span>
              <span className="text-xs text-stone-500 mt-1">This task is ready for implementation</span>
            </div>
          ) : (
            <>
              {/* Status banner */}
              {inPlanning && (
                <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <div>
                    <div className="text-sm font-medium text-amber-400">Agent is working on the {phaseType} plan...</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      The plan will appear here when the agent finishes
                    </div>
                  </div>
                </div>
              )}

              {/* Plan content */}
              {currentPlanContent && (
                <div className="bg-stone-800/60 border border-stone-700/60 rounded-xl">
                  <div className="px-4 py-2.5 border-b border-stone-700/60 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${inReview ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="text-sm font-semibold text-stone-300 capitalize">{phaseType} Plan</span>
                    <span className="text-xs text-stone-600 ml-1">
                      v{phaseType === 'functional' ? (task.functionalPlanVersion ?? 1) : (task.technicalPlanVersion ?? 1)}
                    </span>
                  </div>
                  <div className="px-4 py-3 text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                    {currentPlanContent}
                  </div>
                </div>
              )}

              {/* Show functional plan when in technical phase */}
              {phaseType === 'technical' && planData?.functionalPlan && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-stone-500 hover:text-stone-300 transition-colors">
                    View approved functional plan
                  </summary>
                  <div className="mt-2 bg-stone-800/40 border border-stone-700/40 rounded-lg px-4 py-3 text-sm text-stone-400 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                    {planData.functionalPlan}
                  </div>
                </details>
              )}

              {/* Comments */}
              {currentComments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Feedback</h4>
                  {currentComments.map((c: PlanComment) => (
                    <div key={c.id} className="bg-stone-800/40 border border-stone-700/40 rounded-lg px-3 py-2">
                      <div className="text-xs text-stone-500 mb-1">{new Date(c.createdAt).toLocaleString()}</div>
                      <div className="text-sm text-stone-300">{c.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action bar */}
        {task.planningPhase && task.planningPhase !== 'approved' && (
          <div className="border-t border-stone-800 px-6 py-4 space-y-3 bg-stone-900/80">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={inReview
                ? 'Add feedback or comments on the plan...'
                : 'Add a comment for the planning agent...'
              }
              rows={2}
              className="w-full bg-stone-800/70 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/50 focus:border-amber-700/50 resize-none transition-all duration-150"
            />
            {error && <div className="text-xs text-red-400 animate-fade-in">{error}</div>}
            {success && <div className="text-xs text-emerald-400 animate-fade-in">{success}</div>}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleAddComment}
                disabled={!comment.trim() || submitting}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 disabled:text-stone-600 transition-colors"
              >
                Add comment only
              </button>
              <div className="flex gap-2">
                {inReview && (
                  <>
                    <button
                      onClick={handleRequestChanges}
                      disabled={!comment.trim() || submitting}
                      className="px-4 py-1.5 bg-stone-700 hover:bg-stone-600 disabled:bg-stone-800 disabled:text-stone-600 text-stone-200 text-sm font-medium rounded-lg transition-all duration-150"
                    >
                      {submitting ? '...' : 'Request Changes'}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={submitting}
                      className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
                    >
                      {submitting ? '...' : 'Approve'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
