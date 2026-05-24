import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  type TimeframeType,
  type DateRange,
  getTimeframeRange,
  doRangesOverlap,
  parseDateSafe,
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
  if (!start || !end) return true;
  return doRangesOverlap({ start, end }, range);
}

function contentCountsInTimeframe(
  item: IContentItem,
  timeframe: TimeframeType,
  range: DateRange
): boolean {
  if (item.status === 'published') return false;

  if (item.publishDate) {
    const publishDate = new Date(item.publishDate);
    if (isNaN(publishDate.getTime())) return false;
    publishDate.setHours(0, 0, 0, 0);
    const rangeStart = new Date(range.start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(range.end);
    rangeEnd.setHours(23, 59, 59, 999);
    return publishDate >= rangeStart && publishDate <= rangeEnd;
  }

  return timeframe !== 'today';
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
