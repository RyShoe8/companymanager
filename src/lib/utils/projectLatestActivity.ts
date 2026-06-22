import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';

function toMs(d: Date | string | undefined): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function maxTaskActivityMs(tasks: IProjectTask[] | undefined): number {
  if (!tasks?.length) return 0;
  let max = 0;
  for (const task of tasks) {
    const completedMs = toMs(task.completedAt);
    if (completedMs > max) max = completedMs;
  }
  return max;
}

export function getProjectLatestActivityMs(
  project: IProject,
  contentItemsForProject: IContentItem[] = [],
  latestCommentMs?: number
): number {
  let max = toMs((project as { updatedAt?: Date }).updatedAt ?? project.createdAt);

  const taskMs = maxTaskActivityMs(project.tasks);
  if (taskMs > max) max = taskMs;

  for (const item of contentItemsForProject) {
    const itemMs = toMs(item.updatedAt ?? item.createdAt);
    if (itemMs > max) max = itemMs;
  }

  if (latestCommentMs !== undefined && latestCommentMs > max) {
    max = latestCommentMs;
  }

  return max;
}

/** Max of server/item/local touch signals used for workspace project card sort. */
export function getEffectiveProjectActivityMs(
  serverMs: number,
  itemMs: number,
  localTouchMs?: number
): number {
  return Math.max(serverMs, itemMs, localTouchMs ?? 0);
}

export function buildContentItemsByProjectId(contentItems: IContentItem[]): Map<string, IContentItem[]> {
  const map = new Map<string, IContentItem[]>();
  for (const item of contentItems) {
    const pid = item.projectId?.toString();
    if (!pid) continue;
    const list = map.get(pid) ?? [];
    list.push(item);
    map.set(pid, list);
  }
  return map;
}

/** Sort workspace project cards by latest activity, then unseen count. */
export function compareProjectsForWorkspaceSort(
  aActivityMs: number,
  aUnseenCount: number,
  bActivityMs: number,
  bUnseenCount: number
): number {
  const activityDiff = bActivityMs - aActivityMs;
  if (activityDiff !== 0) return activityDiff;
  return bUnseenCount - aUnseenCount;
}
