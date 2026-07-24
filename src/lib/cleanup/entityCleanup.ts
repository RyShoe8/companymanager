import { Types } from 'mongoose';
import Comment from '@/lib/models/Comment';
import Meeting from '@/lib/models/Meeting';
import ProjectInsightState from '@/lib/models/ProjectInsightState';
import User from '@/lib/models/User';
import { deleteAssetsForTask } from '@/lib/assets/assetCleanup';
import {
  cleanupPublishedContentMedia,
  deleteRecordingsForTask,
} from '@/lib/recordings/recordingCleanup';
import {
  contentItemCommentsFilter,
  projectCommentsFilter,
  taskCommentsFilter,
} from '@/lib/cleanup/commentFilters';

export type RemovedTaskRef = {
  taskId?: string;
  taskIndex: number;
};

export async function deleteCommentsForProject(projectId: string): Promise<number> {
  const result = await Comment.deleteMany(projectCommentsFilter(projectId));
  return result.deletedCount ?? 0;
}

export async function deleteCommentsForTask(
  projectId: string,
  taskId?: string,
  taskIndex?: number
): Promise<number> {
  const filter = taskCommentsFilter(projectId, taskId, taskIndex);
  const result = await Comment.deleteMany(filter);
  return result.deletedCount ?? 0;
}

async function deleteCommentsForContentItem(contentItemId: string): Promise<number> {
  const result = await Comment.deleteMany(contentItemCommentsFilter(contentItemId));
  return result.deletedCount ?? 0;
}

export async function deleteInsightStateForProject(projectId: string): Promise<number> {
  if (!Types.ObjectId.isValid(projectId)) return 0;
  const result = await ProjectInsightState.deleteMany({ projectId: new Types.ObjectId(projectId) });
  return result.deletedCount ?? 0;
}

export async function unlinkProjectFromMeetings(
  projectId: string,
  organizationId: string
): Promise<number> {
  if (!Types.ObjectId.isValid(projectId) || !organizationId) return 0;
  const result = await Meeting.updateMany(
    { organizationId, linkedProjectIds: new Types.ObjectId(projectId) },
    { $pull: { linkedProjectIds: new Types.ObjectId(projectId) } }
  );
  return result.modifiedCount ?? 0;
}

export async function resolveOrganizationIdForProject(
  projectUserId?: { toString(): string }
): Promise<string | null> {
  if (!projectUserId) return null;
  const user = await User.findById(projectUserId.toString()).select('organizationId').lean();
  const orgId = (user as { organizationId?: string } | null)?.organizationId;
  return orgId?.trim() || null;
}

export async function cleanupContentItemDelete(contentItemId: string): Promise<void> {
  await deleteCommentsForContentItem(contentItemId);
  await cleanupPublishedContentMedia(contentItemId);
}

export async function cleanupRemovedTasks(
  projectId: string,
  removedTasks: RemovedTaskRef[]
): Promise<void> {
  for (const removed of removedTasks) {
    await deleteCommentsForTask(projectId, removed.taskId, removed.taskIndex);
    await deleteAssetsForTask({
      taskId: removed.taskId,
      taskIndex: removed.taskIndex,
      projectId,
    });
    if (removed.taskId) {
      await deleteRecordingsForTask(removed.taskId);
    }
  }
}

export function findRemovedTasks(
  previousTasks: Array<{ _id?: { toString(): string } }>,
  nextTasks: Array<{ _id?: { toString(): string } }>
): RemovedTaskRef[] {
  const nextIds = new Set(
    nextTasks.map((task) => task._id?.toString()).filter((id): id is string => Boolean(id))
  );

  const removed: RemovedTaskRef[] = [];
  previousTasks.forEach((task, taskIndex) => {
    const taskId = task._id?.toString();
    if (taskId && !nextIds.has(taskId)) {
      removed.push({ taskId, taskIndex });
    }
  });

  return removed;
}
