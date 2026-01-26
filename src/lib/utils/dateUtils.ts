export type TimeframeType = 'today' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get the start and end dates for the current week
 */
export function getCurrentWeekRange(): DateRange {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get the start and end dates for the current month
 */
export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get the start and end dates for the current quarter
 */
export function getCurrentQuarterRange(): DateRange {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get the start and end dates for the current year
 */
export function getCurrentYearRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31);
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

/**
 * Format a date range to a readable string
 */
export function formatDateRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Check if a date falls within a date range
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/**
 * Check if a date range overlaps with another date range
 */
export function doRangesOverlap(range1: DateRange, range2: DateRange): boolean {
  return range1.start <= range2.end && range1.end >= range2.start;
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

/**
 * Get default task dates (start: now, end: one week from now)
 */
export function getDefaultTaskDates(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { startDate: now, endDate: oneWeekLater };
}
