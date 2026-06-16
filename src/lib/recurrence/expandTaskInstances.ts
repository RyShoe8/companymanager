import type { IProjectTask } from '@/lib/models/Project';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { parseDateSafe } from '@/lib/utils/dateUtils';
import {
  expandInitialSeriesDates,
  newRecurrenceSeriesId,
} from '@/lib/recurrence/recurrenceHorizons';

type TaskRecurrencePreset = Exclude<RecurrencePreset, 'none'>;

function taskDurationMs(task: IProjectTask): number | null {
  const start = parseDateSafe(task.startDate);
  const end = parseDateSafe(task.endDate);
  if (!start || !end) return null;
  return Math.max(0, end.getTime() - start.getTime());
}

export function expandTaskInstances(
  baseTask: IProjectTask,
  options: {
    preset: TaskRecurrencePreset;
    occurrenceStarts?: Date[];
    seriesId?: string;
  }
): IProjectTask[] {
  const start = parseDateSafe(baseTask.startDate);
  if (!start) return [baseTask];
  const durationMs = taskDurationMs(baseTask) ?? 0;

  const occurrenceStarts =
    options.occurrenceStarts ??
    expandInitialSeriesDates(start, options.preset);

  const seriesId = options.seriesId ?? newRecurrenceSeriesId();
  const preset = options.preset;

  return occurrenceStarts.map((occurrenceStart, index) => ({
    ...baseTask,
    ...(index > 0 ? { _id: undefined } : {}),
    recurrenceSeriesId: seriesId,
    recurrencePreset: preset,
    startDate: occurrenceStart,
    endDate: new Date(occurrenceStart.getTime() + durationMs),
  }));
}

export function expandTaskExtensionInstances(
  templateTask: IProjectTask,
  occurrenceStarts: Date[]
): IProjectTask[] {
  const durationMs = taskDurationMs(templateTask);
  if (durationMs === null) return [];
  const seriesId = templateTask.recurrenceSeriesId;
  const preset = (templateTask.recurrencePreset ?? 'weekly') as TaskRecurrencePreset;

  return occurrenceStarts.map((occurrenceStart) => ({
    ...templateTask,
    _id: undefined,
    recurrenceSeriesId: seriesId,
    recurrencePreset: preset,
    startDate: occurrenceStart,
    endDate: new Date(occurrenceStart.getTime() + durationMs),
  }));
}
