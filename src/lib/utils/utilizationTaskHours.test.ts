import { describe, expect, it } from 'vitest';
import { calculateProratedHoursInRange } from './utilizationTaskHours';

describe('calculateProratedHoursInRange', () => {
  const monday = new Date('2026-06-08T12:00:00');
  const friday = new Date('2026-06-12T12:00:00');
  const tuesday = new Date('2026-06-09T12:00:00');

  function dayRange(day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  it('prorates one weekday slice on Today instead of full task hours', () => {
    const { start, end } = dayRange(tuesday);
    expect(calculateProratedHoursInRange(start, end, monday, friday, 40)).toBe(8);
  });

  it('counts full task hours across the containing week', () => {
    const weekStart = new Date('2026-06-08T00:00:00');
    const weekEnd = new Date('2026-06-14T23:59:59.999');
    expect(calculateProratedHoursInRange(weekStart, weekEnd, monday, friday, 40)).toBe(40);
  });

  it('returns 0 when the view range does not overlap the item', () => {
    const { start, end } = dayRange(new Date('2026-06-15T12:00:00'));
    expect(calculateProratedHoursInRange(start, end, monday, friday, 40)).toBe(0);
  });
});
