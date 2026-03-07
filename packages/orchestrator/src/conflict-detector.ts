import type { Task, HumanQueueItem } from '@maestro/core';
import { detectFileConflicts, resolveAgentsPath, writeYaml } from '@maestro/core';

export interface ConflictResult {
  hasConflict: boolean;
  conflictingFiles: string[];
  escalated: boolean;
}

export async function checkAndHandleConflicts(
  projectRoot: string,
  inProgressTasks: Task[],
  candidateTask: Task
): Promise<ConflictResult> {
  const conflictingFiles = detectFileConflicts(inProgressTasks, candidateTask);

  if (conflictingFiles.length === 0) {
    return { hasConflict: false, conflictingFiles: [], escalated: false };
  }

  // Escalate to human queue
  const item: HumanQueueItem = {
    id: `conflict-${Date.now()}`,
    type: 'conflict',
    title: `File conflict for task "${candidateTask.title}"`,
    description: `Files already locked: ${conflictingFiles.join(', ')}`,
    context: {
      candidateTaskId: candidateTask.id,
      conflictingFiles,
      lockingTasks: inProgressTasks
        .filter((t) => t.filesLocked?.some((f) => conflictingFiles.includes(f)))
        .map((t) => t.id),
    },
    createdAt: new Date().toISOString(),
  };

  const itemPath = resolveAgentsPath(projectRoot, 'human-queue', `${item.id}.yaml`);
  await writeYaml(itemPath, item);

  return { hasConflict: true, conflictingFiles, escalated: true };
}
