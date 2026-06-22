import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { buildContentItemsByProjectId } from '@/lib/utils/projectLatestActivity';

function toMs(d: Date | string | undefined): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function maxTaskCompletedAtMs(tasks: IProjectTask[] | undefined): number {
  if (!tasks?.length) return 0;
  let max = 0;
  for (const task of tasks) {
    const ms = toMs(task.completedAt);
    if (ms > max) max = ms;
  }
  return max;
}

function maxContentActivityMs(contentItems: IContentItem[] | undefined): number {
  if (!contentItems?.length) return 0;
  let max = 0;
  for (const item of contentItems) {
    const ms = toMs(item.updatedAt ?? item.createdAt);
    if (ms > max) max = ms;
  }
  return max;
}

function projectRecencyMs(project: IProject, contentItems?: IContentItem[]): number {
  return Math.max(
    toMs((project as { updatedAt?: Date }).updatedAt ?? project.createdAt),
    maxTaskCompletedAtMs(project.tasks),
    maxContentActivityMs(contentItems)
  );
}

export type MergeProjectsPreservingRecencyOptions = {
  contentByProjectId?: Map<string, IContentItem[]>;
};

/** Merge fetched projects with local state, keeping newer recency signals and task snapshots. */
export function mergeProjectsPreservingRecency(
  previous: IProject[],
  fetched: IProject[],
  options?: MergeProjectsPreservingRecencyOptions
): IProject[] {
  const contentByProjectId = options?.contentByProjectId;
  const prevById = new Map(previous.map((p) => [p._id.toString(), p]));

  return fetched.map((fetchedProject) => {
    const id = fetchedProject._id.toString();
    const prevProject = prevById.get(id);
    if (!prevProject) return fetchedProject;

    const prevContent = contentByProjectId?.get(id);
    const fetchedContent = contentByProjectId?.get(id);
    const prevRecency = projectRecencyMs(prevProject, prevContent);
    const fetchedRecency = projectRecencyMs(fetchedProject, fetchedContent);

    if (prevRecency <= fetchedRecency) {
      return fetchedProject;
    }

    const prevUpdatedAt = toMs((prevProject as { updatedAt?: Date }).updatedAt);
    const fetchedUpdatedAt = toMs((fetchedProject as { updatedAt?: Date }).updatedAt);
    const mergedUpdatedAt =
      prevUpdatedAt >= fetchedUpdatedAt
        ? (prevProject as { updatedAt?: Date }).updatedAt ?? new Date(prevUpdatedAt)
        : (fetchedProject as { updatedAt?: Date }).updatedAt;

    const prevTaskCompletedMs = maxTaskCompletedAtMs(prevProject.tasks);
    const fetchedTaskCompletedMs = maxTaskCompletedAtMs(fetchedProject.tasks);
    const mergedTasks =
      prevTaskCompletedMs > fetchedTaskCompletedMs
        ? prevProject.tasks
        : fetchedProject.tasks;

    return {
      ...fetchedProject,
      updatedAt: mergedUpdatedAt,
      tasks: mergedTasks ?? fetchedProject.tasks,
    } as IProject;
  });
}
