import { describe, expect, it } from 'vitest';
import { expandRecurrenceDates, countRecurrenceOccurrences } from '@/lib/recurrence/expandRecurrenceDates';

const anchor = new Date('2026-06-04T12:00:00');

describe('expandRecurrenceDates', () => {
  it('returns a single date for preset none', () => {
    const dates = expandRecurrenceDates({ anchorDate: anchor, preset: 'none' });
    expect(dates).toHaveLength(1);
  });

  it('throws when end is never (no open-ended bulk expansion)', () => {
    expect(() =>
      expandRecurrenceDates({ anchorDate: anchor, preset: 'weekly', end: 'never' })
    ).toThrow(/must end on a date or after/);
  });

  it('expands weekly tasks up to the after count', () => {
    const dates = expandRecurrenceDates({
      anchorDate: anchor,
      preset: 'weekly',
      end: 'after',
      count: 5,
    });
    expect(dates).toHaveLength(5);
  });

  it('rejects after count above 365', () => {
    expect(() =>
      expandRecurrenceDates({
        anchorDate: anchor,
        preset: 'daily',
        end: 'after',
        count: 500,
      })
    ).toThrow(/cannot exceed 365/);
  });

  it('stops at until date for end on', () => {
    const until = new Date('2026-06-18T23:59:59');
    const n = countRecurrenceOccurrences({
      anchorDate: anchor,
      preset: 'weekly',
      end: 'on',
      until,
    });
    expect(n).toBe(3);
  });
});
