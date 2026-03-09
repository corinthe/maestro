import { describe, it, expect } from 'vitest';
import { getReadyTasks, detectFileConflicts, topologicalSort } from '../src/task-graph.js';
import type { Task } from '../src/types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test',
    description: 'Desc',
    status: 'backlog',
    ...overrides,
  };
}

describe('getReadyTasks', () => {
  it('returns backlog tasks with no dependencies', () => {
    const tasks = [makeTask({ id: 'task-1' })];
    const ready = getReadyTasks(tasks);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('task-1');
  });

  it('filters out non-backlog tasks', () => {
    const tasks = [
      makeTask({ id: 'task-1', status: 'in-progress' }),
      makeTask({ id: 'task-2', status: 'done' }),
      makeTask({ id: 'task-3', status: 'blocked' }),
    ];
    expect(getReadyTasks(tasks)).toHaveLength(0);
  });

  it('filters out tasks with unresolved dependencies', () => {
    const tasks = [
      makeTask({ id: 'task-1', dependsOn: ['task-2'] }),
      makeTask({ id: 'task-2', status: 'in-progress' }),
    ];
    expect(getReadyTasks(tasks)).toHaveLength(0);
  });

  it('includes tasks whose dependencies are done', () => {
    const tasks = [
      makeTask({ id: 'task-1', dependsOn: ['task-2'] }),
      makeTask({ id: 'task-2', status: 'done' }),
    ];
    const ready = getReadyTasks(tasks);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('task-1');
  });

  // ── Planning phase filtering ─────────────────────────────────────────────

  it('allows tasks without planningPhase (backward compat)', () => {
    const tasks = [makeTask({ id: 'task-1' })];
    expect(getReadyTasks(tasks)).toHaveLength(1);
  });

  it('allows tasks with planningPhase approved', () => {
    const tasks = [makeTask({ id: 'task-1', planningPhase: 'approved' })];
    expect(getReadyTasks(tasks)).toHaveLength(1);
  });

  it('filters out tasks in functional-planning', () => {
    const tasks = [makeTask({ id: 'task-1', planningPhase: 'functional-planning' })];
    expect(getReadyTasks(tasks)).toHaveLength(0);
  });

  it('filters out tasks in functional-review', () => {
    const tasks = [makeTask({ id: 'task-1', planningPhase: 'functional-review' })];
    expect(getReadyTasks(tasks)).toHaveLength(0);
  });

  it('filters out tasks in technical-planning', () => {
    const tasks = [makeTask({ id: 'task-1', planningPhase: 'technical-planning' })];
    expect(getReadyTasks(tasks)).toHaveLength(0);
  });

  it('filters out tasks in technical-review', () => {
    const tasks = [makeTask({ id: 'task-1', planningPhase: 'technical-review' })];
    expect(getReadyTasks(tasks)).toHaveLength(0);
  });

  it('mixes planning and non-planning tasks correctly', () => {
    const tasks = [
      makeTask({ id: 'task-1' }),
      makeTask({ id: 'task-2', planningPhase: 'functional-planning' }),
      makeTask({ id: 'task-3', planningPhase: 'approved' }),
    ];
    const ready = getReadyTasks(tasks);
    expect(ready).toHaveLength(2);
    const ids = ready.map((t) => t.id);
    expect(ids).toContain('task-1');
    expect(ids).toContain('task-3');
  });
});

describe('detectFileConflicts', () => {
  it('returns empty when no conflicts', () => {
    const inProgress = [makeTask({ id: 'task-1', filesLocked: ['a.ts'] })];
    const candidate = makeTask({ id: 'task-2', filesLocked: ['b.ts'] });
    expect(detectFileConflicts(inProgress, candidate)).toEqual([]);
  });

  it('returns conflicting files', () => {
    const inProgress = [makeTask({ id: 'task-1', filesLocked: ['a.ts', 'b.ts'] })];
    const candidate = makeTask({ id: 'task-2', filesLocked: ['b.ts', 'c.ts'] });
    expect(detectFileConflicts(inProgress, candidate)).toEqual(['b.ts']);
  });
});

describe('topologicalSort', () => {
  it('sorts by dependencies', () => {
    const tasks = [
      makeTask({ id: 'task-2', dependsOn: ['task-1'] }),
      makeTask({ id: 'task-1' }),
    ];
    const sorted = topologicalSort(tasks);
    const ids = sorted.map((t) => t.id);
    expect(ids.indexOf('task-1')).toBeLessThan(ids.indexOf('task-2'));
  });
});
