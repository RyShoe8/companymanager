import ContentItem from '@/lib/models/ContentItem';
import { deleteAssetsForProject } from '@/lib/assets/assetCleanup';
import { deleteRecordingsForProject } from '@/lib/recordings/recordingCleanup';
import { deleteStoredFile } from '@/lib/storage/deleteStoredFile';
import {
  deleteCommentsForProject,
  deleteInsightStateForProject,
  resolveOrganizationIdForProject,
  unlinkProjectFromMeetings,
} from '@/lib/cleanup/entityCleanup';

type ProjectTaskRef = {
  _id?: { toString: () => string };
};

type ProjectForCleanup = {
  logo?: string;
  tasks?: ProjectTaskRef[];
  userId?: { toString: () => string };
};

export async function cleanupProjectMedia(
  projectId: string,
  project: ProjectForCleanup,
  organizationId?: string
): Promise<void> {
  const contentItems = await ContentItem.find({ projectId }).select('_id').lean();
  const contentItemIds = contentItems
    .map((item) => item._id?.toString())
    .filter((id): id is string => Boolean(id));

  const taskIds = (project.tasks ?? [])
    .map((task) => task._id?.toString())
    .filter((id): id is string => Boolean(id));

  try {
    const orgId = organizationId ?? (await resolveOrganizationIdForProject(project.userId));
    await deleteCommentsForProject(projectId);
    await deleteInsightStateForProject(projectId);
    if (orgId) {
      await unlinkProjectFromMeetings(projectId, orgId);
    }
    await deleteAssetsForProject(projectId, taskIds, contentItemIds);
    await deleteRecordingsForProject(projectId, taskIds, contentItemIds);
    await deleteStoredFile(project.logo);
    await ContentItem.deleteMany({ projectId });
  } catch (error) {
    console.error('cleanupProjectMedia failed:', projectId, error);
  }
}

export function normalizeTaskStatus(status: unknown): 'active' | 'completed' | 'in-review' {
  const statusStr = String(status ?? 'active')
    .toLowerCase()
    .trim();
  if (statusStr === 'completed' || statusStr === 'complete') return 'completed';
  if (statusStr === 'in-review' || statusStr === 'in_review') return 'in-review';
  return 'active';
}

export async function cleanupNewlyCompletedTasks(
  projectId: string,
  previousTasks: ProjectTaskRef[],
  nextTasks: Array<{ _id?: { toString: () => string }; status?: unknown }>
): Promise<void> {
  const { cleanupCompletedTaskMedia } = await import('@/lib/recordings/recordingCleanup');

  for (let index = 0; index < nextTasks.length; index += 1) {
    const nextTask = nextTasks[index];
    const nextStatus = normalizeTaskStatus(nextTask.status);
    if (nextStatus !== 'completed') continue;

    const taskId = nextTask._id?.toString();
    const previousTask = taskId
      ? previousTasks.find((task) => task._id?.toString() === taskId)
      : previousTasks[index];
    const previousStatus = normalizeTaskStatus(
      (previousTask as { status?: unknown } | undefined)?.status
    );

    if (previousStatus === 'completed') continue;

    await cleanupCompletedTaskMedia({
      taskId,
      taskIndex: index,
      projectId,
    });
  }
}
