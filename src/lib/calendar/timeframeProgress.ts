import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  parseDateSafe,
  taskOverlapsViewRange,
  localCalendarDayIndex,
  taskCalendarDayIndex,
} from '@/lib/utils/dateUtils';
import {
  filterContentToSeriesRepresentatives,
  filterTasksToSeriesRepresentatives,
} from '@/lib/recurrence/filterSeriesRepresentatives';

function contentPublishDateInRange(
  item: IContentItem,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  if (!item.publishDate) return false;
  const d = parseDateSafe(item.publishDate);
  if (!d) return false;
  const v0 = localCalendarDayIndex(rangeStart);
  const v1 = localCalendarDayIndex(rangeEnd);
  const t0 = taskCalendarDayIndex(d);
  return t0 >= v0 && t0 <= v1;
}

function countProjectTimeframeItems(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date
): { total: number; completed: number } {
  const projectIdStr = project._id.toString();
  let total = 0;
  let completed = 0;

  const displayTasks = filterTasksToSeriesRepresentatives(project.tasks ?? [], {
    mode: 'active',
    referenceDate,
  });
  for (const task of displayTasks) {
    const taskStart = parseDateSafe(task.startDate);
    const taskEnd = parseDateSafe(task.endDate);
    if (!taskStart || !taskEnd) continue;
    if (!taskOverlapsViewRange(rangeStart, rangeEnd, taskStart, taskEnd)) continue;
    total += 1;
    if (task.status === 'completed') completed += 1;
  }

  const projectContent = contentItems.filter(
    (item) => item.projectId?.toString() === projectIdStr
  );
  const displayContent = filterContentToSeriesRepresentatives(projectContent, {
    mode: 'active',
    referenceDate,
  });
  for (const item of displayContent) {
    if (!contentPublishDateInRange(item, rangeStart, rangeEnd)) continue;
    total += 1;
    if (item.status === 'published') completed += 1;
  }

  return { total, completed };
}

export function computeProjectTimeframeProgress(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date
): number {
  const { total, completed } = countProjectTimeframeItems(
    project,
    contentItems,
    rangeStart,
    rangeEnd,
    referenceDate
  );
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function computeClientTimeframeProgress(
  projects: IProject[],
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date
): number {
  let total = 0;
  let completed = 0;
  for (const project of projects) {
    const counts = countProjectTimeframeItems(
      project,
      contentItems,
      rangeStart,
      rangeEnd,
      referenceDate
    );
    total += counts.total;
    completed += counts.completed;
  }
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
