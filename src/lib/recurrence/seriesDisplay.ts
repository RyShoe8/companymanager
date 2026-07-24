import type { IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { taskIdString } from '@/lib/projects/taskArrayGuards';
import {
  getSeriesPosition,
  sortByDateAsc,
  type SeriesPosition,
} from '@/lib/recurrence/recurrenceHorizons';
import { parseDateSafe } from '@/lib/utils/dateUtils';

/** Show extend control when this many or fewer occurrences remain (including current). */
const EXTEND_SERIES_REMAINING_THRESHOLD = 3;

export function shouldShowExtendSeries(pos: SeriesPosition): boolean {
  const remaining = pos.total - pos.index + 1;
  return remaining <= EXTEND_SERIES_REMAINING_THRESHOLD;
}

export function getTaskSeriesPosition(
  task: IProjectTask,
  allTasks: IProjectTask[]
): SeriesPosition | null {
  const seriesId = task.recurrenceSeriesId;
  if (!seriesId) return null;
  const series = allTasks.filter((t) => t.recurrenceSeriesId === seriesId);
  const sorted = sortByDateAsc(series, (t) => parseDateSafe(t.startDate) ?? new Date(0));
  const id = taskIdString(task);
  if (!id) return null;
  return getSeriesPosition(
    id,
    sorted.map((t) => ({ id: taskIdString(t) ?? '' }))
  );
}

export function getContentSeriesPosition(
  item: IContentItem,
  allItems: IContentItem[]
): SeriesPosition | null {
  const seriesId = item.recurrenceSeriesId;
  if (!seriesId) return null;
  const series = allItems.filter((c) => c.recurrenceSeriesId === seriesId);
  const sorted = sortByDateAsc(series, (c) =>
    c.publishDate ? new Date(c.publishDate) : new Date(0)
  );
  const id = item._id.toString();
  return getSeriesPosition(
    id,
    sorted.map((c) => ({ id: c._id.toString() }))
  );
}
