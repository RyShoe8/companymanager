function normalizeToStartOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function normalizeToEndOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

/** Weekdays (Mon–Fri) between two dates, inclusive. */
export function countWeekdaysInRange(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Prorate estimated hours across weekdays in the item range for the view range.
 * Used for Today, Weekly, Monthly, etc. so a single day gets its fair share.
 */
export function calculateProratedHoursInRange(
  rangeStart: Date,
  rangeEnd: Date,
  itemStart: Date,
  itemEnd: Date,
  totalHours: number
): number {
  const normalizedItemStart = normalizeToStartOfDay(itemStart);
  const normalizedItemEnd = normalizeToEndOfDay(itemEnd);
  const normalizedRangeStart = normalizeToStartOfDay(rangeStart);
  const normalizedRangeEnd = normalizeToEndOfDay(rangeEnd);

  if (
    normalizedItemStart.getTime() > normalizedRangeEnd.getTime() ||
    normalizedItemEnd.getTime() < normalizedRangeStart.getTime()
  ) {
    return 0;
  }

  const overlapStart =
    normalizedItemStart > normalizedRangeStart ? normalizedItemStart : normalizedRangeStart;
  const overlapEnd =
    normalizedItemEnd < normalizedRangeEnd ? normalizedItemEnd : normalizedRangeEnd;

  if (overlapStart.getTime() > overlapEnd.getTime()) return 0;

  const itemDurationWeekdays = countWeekdaysInRange(normalizedItemStart, normalizedItemEnd);
  if (itemDurationWeekdays <= 0) return 0;

  const overlapWeekdays = countWeekdaysInRange(overlapStart, overlapEnd);
  if (overlapWeekdays < 1) return 0;

  return (totalHours * overlapWeekdays) / itemDurationWeekdays;
}
