import { Types } from 'mongoose';

export function projectCommentsFilter(projectId: string): Record<string, unknown> {
  if (!Types.ObjectId.isValid(projectId)) return { _id: null };
  const objectId = new Types.ObjectId(projectId);
  return {
    $or: [
      { entityType: 'project', entityId: objectId },
      { entityType: 'projectTask', entityId: objectId },
    ],
  };
}

export function taskCommentsFilter(
  projectId: string,
  taskId?: string,
  taskIndex?: number
): Record<string, unknown> {
  if (!Types.ObjectId.isValid(projectId)) return { _id: null };
  const base: Record<string, unknown> = {
    entityType: 'projectTask',
    entityId: new Types.ObjectId(projectId),
  };

  const taskClauses: Record<string, unknown>[] = [];
  if (taskId && Types.ObjectId.isValid(taskId)) {
    taskClauses.push({ taskId: new Types.ObjectId(taskId) });
  }
  if (taskIndex !== undefined && Number.isInteger(taskIndex) && taskIndex >= 0) {
    taskClauses.push({ taskIndex });
  }

  if (taskClauses.length === 0) return base;
  if (taskClauses.length === 1) return { ...base, ...taskClauses[0] };
  return { ...base, $or: taskClauses };
}

export function contentItemCommentsFilter(contentItemId: string): Record<string, unknown> {
  if (!Types.ObjectId.isValid(contentItemId)) return { _id: null };
  return {
    entityType: 'contentItem',
    entityId: new Types.ObjectId(contentItemId),
  };
}
