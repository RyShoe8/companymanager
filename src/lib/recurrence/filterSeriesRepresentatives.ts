import type { IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { taskIdString } from '@/lib/projects/taskArrayGuards';
import { sortByDateAsc } from '@/lib/recurrence/recurrenceHorizons';
import {
  localCalendarDayIndex,
  parseDateSafe,
  taskCalendarDayIndex,
  taskInDisplayRange,
} from '@/lib/utils/dateUtils';

function taskSortDate(task: IProjectTask): Date {
  return parseDateSafe(task.startDate) ?? new Date(0);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pickUpcomingTaskInSeries(seriesTasks: IProjectTask[], referenceDate: Date): IProjectTask | null {
  const active = seriesTasks.filter((t) => t.status !== 'completed');
  if (active.length === 0) return null;
  const sorted = sortByDateAsc(active, taskSortDate);
  const ref = startOfDay(referenceDate).getTime();

  const inProgress = sorted.find((t) => {
    const start = parseDateSafe(t.startDate)?.getTime();
    const end = parseDateSafe(t.endDate)?.getTime();
    if (start == null && end == null) return true;
    if (start != null && end == null) return start <= ref;
    if (start == null || end == null) return false;
    return start <= ref && end >= ref;
  });
  if (inProgress) return inProgress;

  const next = sorted.find((t) => (parseDateSafe(t.startDate)?.getTime() ?? 0) >= ref);
  if (next) return next;

  return sorted[sorted.length - 1];
}

function pickUpcomingContentInSeries(seriesItems: IContentItem[], referenceDate: Date): IContentItem | null {
  const active = seriesItems.filter((c) => c.status !== 'published');
  if (active.length === 0) return null;
  const sorted = sortByDateAsc(active, (c) =>
    c.publishDate ? new Date(c.publishDate) : new Date(0)
  );
  const ref = startOfDay(referenceDate).getTime();

  const next = sorted.find((c) => {
    const d = c.publishDate ? new Date(c.publishDate).getTime() : 0;
    return d >= ref;
  });
  if (next) return next;

  return sorted[sorted.length - 1];
}

function pickCompletedRepresentative<T>(
  items: T[],
  getSortDate: (item: T) => Date,
  isDone: (item: T) => boolean
): T | null {
  const done = sortByDateAsc(
    items.filter(isDone),
    getSortDate
  );
  return done.length > 0 ? done[done.length - 1] : null;
}

/** Keep one task per recurrence series — the most upcoming active instance, or latest completed. */
export function filterTasksToSeriesRepresentatives(
  tasks: IProjectTask[],
  options: { mode: 'active' | 'completed'; referenceDate?: Date }
): IProjectTask[] {
  const ref = options.referenceDate ?? new Date();
  const withoutSeries: IProjectTask[] = [];
  const bySeries = new Map<string, IProjectTask[]>();

  tasks.forEach((task, index) => {
    const seriesId = task.recurrenceSeriesId;
    if (!seriesId) {
      withoutSeries.push(task);
      return;
    }
    const list = bySeries.get(seriesId) ?? [];
    list.push(task);
    bySeries.set(seriesId, list);
  });

  const representatives: IProjectTask[] = [...withoutSeries];

  for (const seriesTasks of bySeries.values()) {
    const rep =
      options.mode === 'completed'
        ? pickCompletedRepresentative(
            seriesTasks,
            taskSortDate,
            (t) => t.status === 'completed'
          )
        : pickUpcomingTaskInSeries(seriesTasks, ref);
    if (rep) representatives.push(rep);
  }

  return representatives;
}

/** Keep one content item per recurrence series — the most upcoming unpublished, or latest published. */
export function filterContentToSeriesRepresentatives(
  items: IContentItem[],
  options: { mode: 'active' | 'completed'; referenceDate?: Date }
): IContentItem[] {
  const ref = options.referenceDate ?? new Date();
  const withoutSeries: IContentItem[] = [];
  const bySeries = new Map<string, IContentItem[]>();

  for (const item of items) {
    const seriesId = item.recurrenceSeriesId;
    if (!seriesId) {
      withoutSeries.push(item);
      continue;
    }
    const list = bySeries.get(seriesId) ?? [];
    list.push(item);
    bySeries.set(seriesId, list);
  }

  const representatives: IContentItem[] = [...withoutSeries];

  for (const seriesItems of bySeries.values()) {
    const rep =
      options.mode === 'completed'
        ? pickCompletedRepresentative(
            seriesItems,
            (c) => (c.publishDate ? new Date(c.publishDate) : new Date(0)),
            (c) => c.status === 'published'
          )
        : pickUpcomingContentInSeries(seriesItems, ref);
    if (rep) representatives.push(rep);
  }

  return representatives;
}

function taskOverlapsRange(task: IProjectTask, rangeStart: Date, rangeEnd: Date): boolean {
  return taskInDisplayRange(task, rangeStart, rangeEnd);
}

/** Content belongs to a calendar range if undated or publish day falls within the range. */
function contentInDisplayRange(
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

/** One task per recurrence series whose instance overlaps the view range. */
export function filterTasksToSeriesRepresentativesInRange(
  tasks: IProjectTask[],
  rangeStart: Date,
  rangeEnd: Date,
  options: { mode: 'active' | 'completed'; referenceDate?: Date }
): IProjectTask[] {
  const ref = options.referenceDate ?? new Date();
  const withoutSeries: IProjectTask[] = [];
  const bySeries = new Map<string, IProjectTask[]>();

  for (const task of tasks) {
    const seriesId = task.recurrenceSeriesId;
    if (!seriesId) {
      if (taskOverlapsRange(task, rangeStart, rangeEnd)) {
        withoutSeries.push(task);
      }
      continue;
    }
    const list = bySeries.get(seriesId) ?? [];
    list.push(task);
    bySeries.set(seriesId, list);
  }

  const representatives: IProjectTask[] = [...withoutSeries];

  for (const seriesTasks of bySeries.values()) {
    const inRange = seriesTasks.filter((t) => taskOverlapsRange(t, rangeStart, rangeEnd));
    if (inRange.length === 0) continue;
    const rep =
      options.mode === 'completed'
        ? pickCompletedRepresentative(
            inRange,
            taskSortDate,
            (t) => t.status === 'completed'
          )
        : pickUpcomingTaskInSeries(inRange, ref);
    if (rep) representatives.push(rep);
  }

  return representatives;
}

/** One content item per recurrence series whose instance falls in the view range (undated always in range). */
export function filterContentToSeriesRepresentativesInRange(
  items: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  options: { mode: 'active' | 'completed'; referenceDate?: Date }
): IContentItem[] {
  const ref = options.referenceDate ?? new Date();
  const withoutSeries: IContentItem[] = [];
  const bySeries = new Map<string, IContentItem[]>();

  for (const item of items) {
    const seriesId = item.recurrenceSeriesId;
    if (!seriesId) {
      if (contentInDisplayRange(item, rangeStart, rangeEnd)) {
        withoutSeries.push(item);
      }
      continue;
    }
    const list = bySeries.get(seriesId) ?? [];
    list.push(item);
    bySeries.set(seriesId, list);
  }

  const representatives: IContentItem[] = [...withoutSeries];

  for (const seriesItems of bySeries.values()) {
    const inRange = seriesItems.filter((item) => contentInDisplayRange(item, rangeStart, rangeEnd));
    if (inRange.length === 0) continue;
    const rep =
      options.mode === 'completed'
        ? pickCompletedRepresentative(
            inRange,
            (c) => (c.publishDate ? new Date(c.publishDate) : new Date(0)),
            (c) => c.status === 'published'
          )
        : pickUpcomingContentInSeries(inRange, ref);
    if (rep) representatives.push(rep);
  }

  return representatives;
}

/** Whether a task should appear in list/calendar views (one per recurrence series). */
function isTaskSeriesRepresentative(
  task: IProjectTask,
  allTasks: IProjectTask[],
  referenceDate?: Date
): boolean {
  if (!task.recurrenceSeriesId) return true;
  const mode = task.status === 'completed' ? 'completed' : 'active';
  const reps = filterTasksToSeriesRepresentatives(allTasks, {
    mode,
    referenceDate,
  });
  const key = taskIdString(task);
  return reps.some((t) => (key ? taskIdString(t) === key : t === task));
}

/** Whether a content item should appear in list/calendar views (one per recurrence series). */
function isContentSeriesRepresentative(
  item: IContentItem,
  allItems: IContentItem[],
  referenceDate?: Date
): boolean {
  if (!item.recurrenceSeriesId) return true;
  const mode = item.status === 'published' ? 'completed' : 'active';
  const reps = filterContentToSeriesRepresentatives(allItems, {
    mode,
    referenceDate,
  });
  const id = item._id.toString();
  return reps.some((c) => c._id.toString() === id);
}
