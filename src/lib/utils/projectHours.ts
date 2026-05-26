import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  type TimeframeType,
  type DateRange,
  getTimeframeRange,
  parseDateSafe,
  taskOverlapsViewRange,
} from '@/lib/utils/dateUtils';

function parseHours(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function projectIdStr(project: IProject): string {
  return project._id.toString();
}

function contentProjectIdStr(item: IContentItem): string {
  const pid = item.projectId as unknown;
  if (typeof pid === 'string') return pid;
  if (pid && typeof (pid as { toString?: () => string }).toString === 'function') {
    return (pid as { toString: () => string }).toString();
  }
  return '';
}

function taskOverlapsTimeframe(task: IProjectTask, range: DateRange): boolean {
  const start = parseDateSafe(task.startDate);
  const end = parseDateSafe(task.endDate);
  if (!start || !end) return false;
  return taskOverlapsViewRange(range.start, range.end, start, end);
}

export function contentCountsInViewPeriod(
  item: IContentItem,
  timeframe: TimeframeType,
  viewStart: Date,
  viewEnd: Date,
  options?: { forCompleted?: boolean }
): boolean {
  if (options?.forCompleted) {
    if (item.status !== 'published') return false;
  } else if (item.status === 'published') {
    return false;
  }

  if (item.publishDate) {
    const publishDate = parseDateSafe(item.publishDate);
    if (!publishDate) return false;
    return taskOverlapsViewRange(viewStart, viewEnd, publishDate, publishDate);
  }

  return timeframe !== 'today';
}

function contentCountsInTimeframe(
  item: IContentItem,
  timeframe: TimeframeType,
  range: DateRange
): boolean {
  return contentCountsInViewPeriod(item, timeframe, range.start, range.end);
}

export function sumTaskHoursInTimeframe(project: IProject, range: DateRange): number {
  let total = 0;
  for (const task of project.tasks || []) {
    if (task.status === 'completed') continue;
    if (!taskOverlapsTimeframe(task, range)) continue;
    total += parseHours(task.estimatedHours);
  }
  return total;
}

export function sumContentHoursInTimeframe(
  projectId: string,
  contentItems: IContentItem[],
  timeframe: TimeframeType,
  range: DateRange
): number {
  let total = 0;
  for (const item of contentItems) {
    if (contentProjectIdStr(item) !== projectId) continue;
    if (!contentCountsInTimeframe(item, timeframe, range)) continue;
    total += parseHours(item.estimatedHours);
  }
  return total;
}

export function computeProjectEstimatedHours(
  project: IProject,
  contentItems: IContentItem[],
  timeframe: TimeframeType,
  referenceDate?: Date
): number {
  const range = getTimeframeRange(timeframe, referenceDate);
  const pid = projectIdStr(project);
  const total =
    sumTaskHoursInTimeframe(project, range) +
    sumContentHoursInTimeframe(pid, contentItems, timeframe, range);
  return Math.round(total * 100) / 100;
}
