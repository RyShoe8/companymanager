import type { IProjectTask } from '@/lib/models/Project';
import { getTaskAssigneeEmployeeIds } from '@/lib/utils/projectTeam';
import { taskIdString } from '@/lib/projects/taskArrayGuards';

function assigneeIdsEqual(a: IProjectTask, b: IProjectTask): boolean {
  const aIds = getTaskAssigneeEmployeeIds(a);
  const bIds = getTaskAssigneeEmployeeIds(b);
  if (aIds.length !== bIds.length) return false;
  return aIds.every((id, i) => id === bIds[i]);
}

/** True when task fields relevant to inspector display/save merge match. */
export function tasksSemanticallyEqual(a: IProjectTask, b: IProjectTask): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.status === b.status &&
    String(a.estimatedHours ?? '') === String(b.estimatedHours ?? '') &&
    String(a.startDate ?? '') === String(b.startDate ?? '') &&
    String(a.endDate ?? '') === String(b.endDate ?? '') &&
    assigneeIdsEqual(a, b)
  );
}

/**
 * Merge server tasks into previous, preserving object identity when a slot is
 * unchanged so React can skip re-renders.
 */
export function mergeTasksPreservingReferences(
  prev: IProjectTask[] | undefined,
  server: IProjectTask[]
): IProjectTask[] {
  const prevTasks = prev ?? [];
  if (prevTasks.length !== server.length) return server;
  return server.map((serverTask, i) => {
    const prevTask = prevTasks[i];
    if (!prevTask) return serverTask;
    const prevId = taskIdString(prevTask);
    const serverId = taskIdString(serverTask);
    const sameSlot =
      (prevId && serverId && prevId === serverId) || (!prevId && !serverId);
    if (sameSlot && tasksSemanticallyEqual(prevTask, serverTask)) {
      return prevTask;
    }
    return serverTask;
  });
}
