import { Types } from 'mongoose';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import { cleanupProjectMedia } from '@/lib/projects/projectCleanup';
import {
  cleanupContentItemDelete,
  deleteCommentsForTask,
} from '@/lib/cleanup/entityCleanup';
import { deleteAssetsForTask } from '@/lib/assets/assetCleanup';
import { deleteRecordingsForTask } from '@/lib/recordings/recordingCleanup';
import {
  isContentEligibleForPurge,
  isLegacyRetentionCandidate,
  isProjectEligibleForPurge,
  isTaskEligibleForPurge,
} from '@/lib/cleanup/retentionEligibility';
import { isRetentionDryRun, retentionCutoffDate } from '@/lib/cleanup/retentionConfig';

export type DataRetentionSummary = {
  dryRun: boolean;
  cutoff: string;
  projectsDeleted: number;
  contentDeleted: number;
  tasksPruned: number;
  skippedLegacy: number;
};

type TaskSubdoc = {
  _id?: Types.ObjectId;
  status?: string;
  completedAt?: Date;
};

export async function runDataRetention(now = new Date()): Promise<DataRetentionSummary> {
  const dryRun = isRetentionDryRun();
  const cutoff = retentionCutoffDate(now);
  const summary: DataRetentionSummary = {
    dryRun,
    cutoff: cutoff.toISOString(),
    projectsDeleted: 0,
    contentDeleted: 0,
    tasksPruned: 0,
    skippedLegacy: 0,
  };

  const completedProjects = await Project.find({
    status: 'completed',
    completedAt: { $exists: true, $lte: cutoff },
  }).lean();

  for (const project of completedProjects) {
    const projectId = project._id?.toString();
    if (!projectId) continue;

    if (!isProjectEligibleForPurge(project, cutoff)) {
      if (isLegacyRetentionCandidate('project', project)) summary.skippedLegacy += 1;
      continue;
    }

    if (!dryRun) {
      await cleanupProjectMedia(projectId, project);
      await Project.deleteOne({ _id: project._id });
    }
    summary.projectsDeleted += 1;
  }

  const publishedContent = await ContentItem.find({
    status: 'published',
    statusPublishedAt: { $exists: true, $lte: cutoff },
  }).lean();

  for (const item of publishedContent) {
    const contentId = item._id?.toString();
    if (!contentId) continue;

    if (!isContentEligibleForPurge(item, cutoff)) {
      if (isLegacyRetentionCandidate('content', item)) summary.skippedLegacy += 1;
      continue;
    }

    const projectExists = await Project.exists({ _id: item.projectId });
    if (!projectExists) continue;

    if (!dryRun) {
      await cleanupContentItemDelete(contentId);
      await ContentItem.deleteOne({ _id: item._id });
    }
    summary.contentDeleted += 1;
  }

  const activeProjects = await Project.find({ status: { $ne: 'completed' } })
    .select('_id tasks')
    .lean();

  for (const project of activeProjects) {
    const projectId = project._id?.toString();
    if (!projectId) continue;

    const tasks = (project.tasks ?? []) as TaskSubdoc[];
    const tasksToPrune = tasks.filter((task) => {
      if (isLegacyRetentionCandidate('task', task)) {
        summary.skippedLegacy += 1;
        return false;
      }
      return isTaskEligibleForPurge(task, cutoff);
    });

    for (const task of tasksToPrune) {
      const taskId = task._id?.toString();
      if (!taskId) continue;

      if (!dryRun) {
        await deleteCommentsForTask(projectId, taskId);
        await deleteAssetsForTask({ taskId, projectId });
        await deleteRecordingsForTask(taskId);
        await Project.updateOne(
          { _id: project._id },
          { $pull: { tasks: { _id: task._id } } }
        );
      }
      summary.tasksPruned += 1;
    }
  }

  return summary;
}
