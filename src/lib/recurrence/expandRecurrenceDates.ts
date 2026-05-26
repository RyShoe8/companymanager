import {
  type BuildRecurrenceOptions,
  type RecurrenceEnd,
  type RecurrencePreset,
  validateRecurrenceInput,
} from '@/lib/scheduling/recurrence';

export type ExpandRecurrenceOptions = {
  anchorDate: Date;
  preset: RecurrencePreset;
  end?: RecurrenceEnd;
  until?: Date;
  count?: number;
};

const MAX_OCCURRENCES = 365;

function advanceDate(date: Date, preset: RecurrencePreset): Date {
  const next = new Date(date);
  switch (preset) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      break;
  }
  return next;
}

/** Returns occurrence dates including the anchor (first) date. */
export function expandRecurrenceDates(options: ExpandRecurrenceOptions): Date[] {
  const { anchorDate, preset, end = 'never', until, count } = options;

  if (preset === 'none') {
    return [new Date(anchorDate)];
  }

  const validationOpts: BuildRecurrenceOptions = {
    preset,
    start: anchorDate,
    end,
    until,
    count,
  };
  const err = validateRecurrenceInput(validationOpts);
  if (err) throw new Error(err);

  const dates: Date[] = [new Date(anchorDate)];

  let maxTotal = MAX_OCCURRENCES;
  if (end === 'after' && count != null) {
    maxTotal = Math.min(Math.floor(count), MAX_OCCURRENCES);
  }

  const untilMs =
    end === 'on' && until
      ? new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59, 59, 999).getTime()
      : null;

  let current = new Date(anchorDate);
  while (dates.length < maxTotal) {
    current = advanceDate(current, preset);
    if (untilMs != null && current.getTime() > untilMs) break;
    dates.push(new Date(current));
  }

  return dates;
}

export function countRecurrenceOccurrences(options: ExpandRecurrenceOptions): number {
  return expandRecurrenceDates(options).length;
}
