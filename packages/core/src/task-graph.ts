import type { Task } from './types.js';

export function getReadyTasks(tasks: Task[]): Task[] {
  const doneTasks = new Set(
    tasks.filter((t) => t.status === 'done').map((t) => t.id)
  );

  return tasks.filter((task) => {
    if (task.status !== 'backlog') return false;
    if (!task.dependsOn || task.dependsOn.length === 0) return true;
    return task.dependsOn.every((dep) => doneTasks.has(dep));
  });
}

export function detectFileConflicts(
  inProgressTasks: Task[],
  candidateTask: Task
): string[] {
  const lockedFiles = new Set<string>();
  for (const task of inProgressTasks) {
    if (task.filesLocked) {
      for (const file of task.filesLocked) {
        lockedFiles.add(file);
      }
    }
  }

  if (!candidateTask.filesLocked) return [];
  return candidateTask.filesLocked.filter((file) => lockedFiles.has(file));
}

export function topologicalSort(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const sorted: Task[] = [];

  function visit(taskId: string): void {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = taskMap.get(taskId);
    if (!task) return;

    if (task.dependsOn) {
      for (const dep of task.dependsOn) {
        visit(dep);
      }
    }

    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return sorted;
}
