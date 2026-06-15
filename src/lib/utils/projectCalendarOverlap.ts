import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  localCalendarDayIndex,
  parseDateSafe,
  taskCalendarDayIndex,
  taskOverlapsViewRange,
} from '@/lib/utils/dateUtils';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function contentPublishDateInRange(
  item: IContentItem,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  if (!item.publishDate) return true;
  const d = parseDateSafe(item.publishDate);
  if (!d) return true;
  const v0 = localCalendarDayIndex(rangeStart);
  const v1 = localCalendarDayIndex(rangeEnd);
  const t0 = taskCalendarDayIndex(d);
  return t0 >= v0 && t0 <= v1;
}

function projectFallbackSpanOverlaps(
  project: IProject,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const pStart = new Date(project.createdAt);
  const pEnd = project.endDate
    ? new Date(project.endDate)
    : new Date(pStart.getTime() + THIRTY_DAYS_MS);
  return taskOverlapsViewRange(rangeStart, rangeEnd, pStart, pEnd);
}

/** Whether a project should appear in a monthly/quarterly calendar bucket. */
export function projectOverlapsDateRange(
  project: IProject,
  rangeStart: Date,
  rangeEnd: Date,
  contentItems: IContentItem[] = []
): boolean {
  const projectId = project._id.toString();

  if (project.tasks && project.tasks.length > 0) {
    for (const task of project.tasks) {
      const taskStart = parseDateSafe(task.startDate);
      const taskEnd = parseDateSafe(task.endDate);
      if (!taskStart || !taskEnd) continue;
      if (taskOverlapsViewRange(rangeStart, rangeEnd, taskStart, taskEnd)) {
        return true;
      }
    }
  }

  for (const item of contentItems) {
    if (item.projectId?.toString() !== projectId) continue;
    if (contentPublishDateInRange(item, rangeStart, rangeEnd)) {
      return true;
    }
  }

  if (!project.tasks || project.tasks.length === 0) {
    return projectFallbackSpanOverlaps(project, rangeStart, rangeEnd);
  }

  return false;
}
