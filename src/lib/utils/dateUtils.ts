export type TimeframeType = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get the start and end dates for the current month
 */
function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get the date range for a given timeframe type
 */
export function getTimeframeRange(timeframe: TimeframeType, referenceDate?: Date): DateRange {
  const date = referenceDate || new Date();
  
  switch (timeframe) {
    case 'today': {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'weekly': {
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      const start = new Date(date);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'monthly': {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'quarterly': {
      const quarter = Math.floor(date.getMonth() / 3);
      const start = new Date(date.getFullYear(), quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date.getFullYear(), (quarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'yearly': {
      const start = new Date(date.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    default:
      return getCurrentMonthRange();
  }
}

/**
 * Format a date to a readable string
 * Accepts Date objects or date strings
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Display for UTC-normalized calendar dates (midnight UTC) — avoids prior-day label in US timezones. */
export function formatCalendarDateUTC(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  return dateObj.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** `YYYY-MM-DD` from `<input type="date">` → UTC midnight for that calendar day. */
export function parseIsoDateOnlyToUtc(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return null;
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(y, mo - 1, day));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== day) return null;
  return utc;
}

/** Initial value for `type="date"` when stored dates are UTC calendar days. */
export function toIsoDateInputValueUTC(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Safely parse a date value, returning undefined if invalid
 * @param dateValue - Date string, Date object, or undefined
 * @returns Valid Date object or undefined
 */
export function parseDateSafe(dateValue: string | Date | undefined | null): Date | undefined {
  if (!dateValue) return undefined;
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? undefined : dateValue;
  }
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/** UTC calendar day index for inclusive range comparisons (matches stored task dates). */
function utcCalendarDayIndex(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Calendar day index for view/navigation dates (local Y-M-D). */
export function localCalendarDayIndex(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Calendar day index for stored task/content dates (UTC Y-M-D from date picker). */
export function taskCalendarDayIndex(date: Date): number {
  return utcCalendarDayIndex(date);
}

/** True when a stored task range overlaps a local view range (inclusive calendar days). */
export function taskOverlapsViewRange(
  viewStart: Date,
  viewEnd: Date,
  taskStart: Date,
  taskEnd: Date
): boolean {
  const v0 = localCalendarDayIndex(viewStart);
  const v1 = localCalendarDayIndex(viewEnd);
  const t0 = taskCalendarDayIndex(taskStart);
  const t1 = taskCalendarDayIndex(taskEnd);
  return t0 <= v1 && t1 >= v0;
}

/** True when publish date falls on the same calendar day as the view day (local vs stored UTC). */
export function publishDateOnViewDay(viewDay: Date, publishDate: Date): boolean {
  return localCalendarDayIndex(viewDay) === taskCalendarDayIndex(publishDate);
}

/** True when a stored task range overlaps a single local view day. */
export function taskOverlapsViewDay(viewDay: Date, taskStart: Date, taskEnd: Date): boolean {
  return taskOverlapsViewRange(viewDay, viewDay, taskStart, taskEnd);
}

/**
 * Whether a task belongs in a calendar range.
 * Undated tasks (no start/end) always match; open-ended tasks (start, no end) match when
 * the range ends on or after the start day.
 */
export function taskInDisplayRange(
  task: { startDate?: Date | string | null; endDate?: Date | string | null },
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const taskStart = parseDateSafe(task.startDate);
  const taskEnd = parseDateSafe(task.endDate);

  if (!taskStart && !taskEnd) return true;
  if (taskStart && !taskEnd) {
    return taskCalendarDayIndex(taskStart) <= localCalendarDayIndex(rangeEnd);
  }
  if (!taskStart && taskEnd) {
    return taskCalendarDayIndex(taskEnd) >= localCalendarDayIndex(rangeStart);
  }
  return taskOverlapsViewRange(rangeStart, rangeEnd, taskStart!, taskEnd!);
}

/** Resolve task dates for list/sort display when end (or start) may be unset. */
export function resolveTaskDisplayDates(
  task: { startDate?: Date | string | null; endDate?: Date | string | null },
  rangeEnd?: Date
): { startDate: Date; endDate: Date } | null {
  const taskStart = parseDateSafe(task.startDate);
  const taskEnd = parseDateSafe(task.endDate);

  if (!taskStart && !taskEnd) {
    const anchor = rangeEnd ?? new Date();
    return { startDate: anchor, endDate: anchor };
  }
  if (taskStart && !taskEnd) {
    return { startDate: taskStart, endDate: rangeEnd ?? taskStart };
  }
  if (!taskStart && taskEnd) {
    return { startDate: taskEnd, endDate: taskEnd };
  }
  return { startDate: taskStart!, endDate: taskEnd! };
}

/**
 * Get default task dates (start: now, end: one week from now)
 */
export function getDefaultTaskDates(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { startDate: now, endDate: oneWeekLater };
}

/** Normalize a task date to UTC midnight, or undefined when unset/invalid. */
export function parseOptionalTaskDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
  const parsed = parseDateSafe(value);
  if (!parsed) return undefined;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
}

/**
 * Parse task date from API/client payload.
 * null/'' = explicitly cleared; undefined = use fallback when provided (new tasks).
 */
export function resolveTaskDateInput(
  value: unknown,
  options?: { fallback?: Date }
): Date | null {
  if (value === null || value === '') return null;
  if (value === undefined) {
    return options?.fallback ?? null;
  }
  return parseOptionalTaskDate(value) ?? options?.fallback ?? null;
}
