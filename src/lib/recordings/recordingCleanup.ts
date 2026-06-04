import { Types } from 'mongoose';
import Recording, { type IRecording } from '@/lib/models/Recording';
import { deleteStoredFile } from '@/lib/storage/deleteStoredFile';

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export async function deleteRecordingStorage(
  recording: Pick<IRecording, 'videoUrl' | 'audioUrl'>
): Promise<void> {
  await deleteStoredFile(recording.videoUrl);
  if (recording.audioUrl) {
    await deleteStoredFile(recording.audioUrl);
  }
}

async function deleteRecordingsByFilter(
  filter: Record<string, unknown>
): Promise<number> {
  const recordings = await Recording.find(filter).lean();
  for (const recording of recordings) {
    await deleteRecordingStorage(recording);
  }
  const result = await Recording.deleteMany(filter);
  return result.deletedCount ?? 0;
}

export async function deleteRecordingsForTask(taskId: string): Promise<number> {
  if (!Types.ObjectId.isValid(taskId)) return 0;
  return deleteRecordingsByFilter({ taskId: toObjectId(taskId) });
}

export async function deleteRecordingsForContentItem(contentItemId: string): Promise<number> {
  if (!Types.ObjectId.isValid(contentItemId)) return 0;
  return deleteRecordingsByFilter({ contentItemId: toObjectId(contentItemId) });
}

export async function deleteRecordingsForProject(
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

  const orFilters: Record<string, unknown>[] = [{ projectId: projectObjectId }];

  if (validTaskIds.length > 0) {
    orFilters.push({ taskId: { $in: validTaskIds } });
  }

  if (validContentIds.length > 0) {
    orFilters.push({ contentItemId: { $in: validContentIds } });
  }

  return deleteRecordingsByFilter({ $or: orFilters });
}

export async function cleanupCompletedTaskMedia({
  taskId,
  taskIndex,
  projectId,
}: {
  taskId?: string;
  taskIndex?: number;
  projectId?: string;
}): Promise<void> {
  const { deleteAssetsForTask } = await import('@/lib/assets/assetCleanup');

  await deleteAssetsForTask({ taskId, taskIndex, projectId });
  if (taskId) {
    await deleteRecordingsForTask(taskId);
  }
}

export async function cleanupPublishedContentMedia(contentItemId: string): Promise<void> {
  const { deleteAssetsForContentItem } = await import('@/lib/assets/assetCleanup');

  await deleteAssetsForContentItem(contentItemId);
  await deleteRecordingsForContentItem(contentItemId);
}
