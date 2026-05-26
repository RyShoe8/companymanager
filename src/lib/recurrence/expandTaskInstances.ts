import type { IProjectTask } from '@/lib/models/Project';
import { expandRecurrenceDates, type ExpandRecurrenceOptions } from '@/lib/recurrence/expandRecurrenceDates';

export function expandTaskInstances(
  baseTask: IProjectTask,
  recurrence: Pick<ExpandRecurrenceOptions, 'preset' | 'end' | 'until' | 'count'>
): IProjectTask[] {
  const start = new Date(baseTask.startDate);
  const end = new Date(baseTask.endDate);
  const durationMs = Math.max(0, end.getTime() - start.getTime());

  const occurrenceStarts = expandRecurrenceDates({
    anchorDate: start,
    ...recurrence,
  });

  const seriesId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `series-${Date.now()}`;

  return occurrenceStarts.map((occurrenceStart) => ({
    ...baseTask,
    recurrenceSeriesId: seriesId,
    startDate: occurrenceStart,
    endDate: new Date(occurrenceStart.getTime() + durationMs),
  }));
}
