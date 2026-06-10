import type { IProjectTask } from '@/lib/models/Project';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import {
  expandInitialSeriesDates,
  newRecurrenceSeriesId,
} from '@/lib/recurrence/recurrenceHorizons';

type TaskRecurrencePreset = Exclude<RecurrencePreset, 'none'>;

export function expandTaskInstances(
  baseTask: IProjectTask,
  options: {
    preset: TaskRecurrencePreset;
    occurrenceStarts?: Date[];
    seriesId?: string;
  }
): IProjectTask[] {
  const start = new Date(baseTask.startDate);
  const end = new Date(baseTask.endDate);
  const durationMs = Math.max(0, end.getTime() - start.getTime());

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
  const start = new Date(templateTask.startDate);
  const end = new Date(templateTask.endDate);
  const durationMs = Math.max(0, end.getTime() - start.getTime());
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
