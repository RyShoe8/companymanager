import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { expandRecurrenceDates } from '@/lib/recurrence/expandRecurrenceDates';

export type ExtendUnit = 'week' | 'month' | 'year';

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

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** End date (inclusive) for the initial series batch from anchor. */
export function getInitialHorizonEnd(anchorDate: Date, preset: RecurrencePreset): Date {
  const end = new Date(anchorDate);
  switch (preset) {
    case 'daily':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'weekly':
    case 'biweekly':
      end.setMonth(end.getMonth() + 6);
      break;
    case 'monthly':
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      break;
  }
  return endOfDay(end);
}

function addExtensionUnit(from: Date, unit: ExtendUnit): Date {
  const end = new Date(from);
  switch (unit) {
    case 'week':
      end.setDate(end.getDate() + 7);
      break;
    case 'month':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'year':
      end.setFullYear(end.getFullYear() + 1);
      break;
  }
  return endOfDay(end);
}

/** Occurrence start dates for a new series (includes anchor). */
export function expandInitialSeriesDates(anchorDate: Date, preset: RecurrencePreset): Date[] {
  if (preset === 'none') return [new Date(anchorDate)];
  const until = getInitialHorizonEnd(anchorDate, preset);
  return expandRecurrenceDates({
    anchorDate,
    preset,
    end: 'on',
    until,
  });
}

/** New occurrence start dates after lastDate through lastDate + unit (excludes lastDate). */
export function expandExtensionDates(
  lastDate: Date,
  preset: RecurrencePreset,
  unit: ExtendUnit
): Date[] {
  if (preset === 'none') return [];
  const extensionEnd = addExtensionUnit(lastDate, unit);
  const dates: Date[] = [];
  let current = advanceDate(new Date(lastDate), preset);
  while (current.getTime() <= extensionEnd.getTime()) {
    dates.push(new Date(current));
    current = advanceDate(current, preset);
  }
  return dates;
}

/** Approximate initial count using a fixed reference date (for RRULE COUNT / docs). */
export function countInitialOccurrences(preset: RecurrencePreset): number {
  const anchor = new Date('2026-01-15T12:00:00');
  return expandInitialSeriesDates(anchor, preset).length;
}

export function getInitialRecurrenceCount(preset: RecurrencePreset, anchorDate: Date): number {
  return expandInitialSeriesDates(anchorDate, preset).length;
}

export type SeriesPosition = { index: number; total: number };

/** 1-based index of itemId within sorted series members. */
export function getSeriesPosition(
  itemId: string,
  sortedItems: { id: string }[]
): SeriesPosition {
  const total = sortedItems.length;
  const idx = sortedItems.findIndex((item) => item.id === itemId);
  return { index: idx >= 0 ? idx + 1 : 1, total: Math.max(total, 1) };
}

export function sortByDateAsc<T>(items: T[], getDate: (item: T) => Date): T[] {
  return [...items].sort(
    (a, b) => getDate(a).getTime() - getDate(b).getTime()
  );
}

export function newRecurrenceSeriesId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `series-${Date.now()}`;
}
