import { Types } from 'mongoose';
import Asset from '@/lib/models/Asset';

export type TaskCleanupTarget = {
  taskId?: string;
  taskIndex?: number;
  projectId?: string;
};

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export async function deleteAssetsForTask({
  taskId,
  taskIndex,
  projectId,
}: TaskCleanupTarget): Promise<number> {
  const filters: Record<string, unknown>[] = [];

  if (taskId && Types.ObjectId.isValid(taskId)) {
    filters.push({ linkedProjectTaskId: toObjectId(taskId) });
  }

  if (
    projectId &&
    Types.ObjectId.isValid(projectId) &&
    taskIndex !== undefined &&
    Number.isInteger(taskIndex) &&
    taskIndex >= 0
  ) {
    filters.push({
      linkedProjectId: toObjectId(projectId),
      linkedProjectTaskIndex: taskIndex,
    });
  }

  if (filters.length === 0) return 0;

  const result = await Asset.deleteMany({ $or: filters });
  return result.deletedCount ?? 0;
}

export async function deleteAssetsForContentItem(contentItemId: string): Promise<number> {
  if (!Types.ObjectId.isValid(contentItemId)) return 0;

  const result = await Asset.deleteMany({
    linkedContentItemId: toObjectId(contentItemId),
  });
  return result.deletedCount ?? 0;
}

export async function deleteAssetsForProject(
  projectId: string,
  taskIds: string[],
  contentItemIds: string[]
): Promise<number> {
  if (!Types.ObjectId.isValid(projectId)) return 0;

  const projectObjectId = toObjectId(projectId);
  const validTaskIds = taskIds.filter((id) => Types.ObjectId.isValid(id)).map(toObjectId);
  const validContentIds = contentItemIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map(toObjectId);

  const orFilters: Record<string, unknown>[] = [{ linkedProjectId: projectObjectId }];

  if (validTaskIds.length > 0) {
    orFilters.push({ linkedProjectTaskId: { $in: validTaskIds } });
  }

  if (validContentIds.length > 0) {
    orFilters.push({ linkedContentItemId: { $in: validContentIds } });
  }

  const result = await Asset.deleteMany({ $or: orFilters });
  return result.deletedCount ?? 0;
}
