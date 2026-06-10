import { describe, expect, it } from 'vitest';
import {
  countInitialOccurrences,
  expandExtensionDates,
  expandInitialSeriesDates,
  getInitialHorizonEnd,
  getSeriesPosition,
  sortByDateAsc,
} from '@/lib/recurrence/recurrenceHorizons';

describe('recurrenceHorizons', () => {
  const anchor = new Date('2026-01-15T12:00:00');

  it('monthly initial horizon is about one year (~12 occurrences)', () => {
    const dates = expandInitialSeriesDates(anchor, 'monthly');
    expect(dates.length).toBeGreaterThanOrEqual(11);
    expect(dates.length).toBeLessThanOrEqual(13);
    expect(countInitialOccurrences('monthly')).toBe(dates.length);
  });

  it('daily initial horizon is about three months (~90 occurrences)', () => {
    const dates = expandInitialSeriesDates(anchor, 'daily');
    expect(dates.length).toBeGreaterThanOrEqual(85);
    expect(dates.length).toBeLessThanOrEqual(95);
  });

  it('weekly initial horizon is about six months (~26 occurrences)', () => {
    const dates = expandInitialSeriesDates(anchor, 'weekly');
    expect(dates.length).toBeGreaterThanOrEqual(24);
    expect(dates.length).toBeLessThanOrEqual(28);
  });

  it('getInitialHorizonEnd matches preset windows', () => {
    const dailyEnd = getInitialHorizonEnd(anchor, 'daily');
    expect(dailyEnd.getMonth()).toBe((anchor.getMonth() + 3) % 12);

    const monthlyEnd = getInitialHorizonEnd(anchor, 'monthly');
    expect(monthlyEnd.getFullYear()).toBe(anchor.getFullYear() + 1);
  });

  it('expandExtensionDates adds occurrences after last date', () => {
    const last = new Date('2026-06-01T12:00:00');
    const extended = expandExtensionDates(last, 'weekly', 'month');
    expect(extended.length).toBeGreaterThan(0);
    expect(extended.every((d) => d.getTime() > last.getTime())).toBe(true);
  });

  it('getSeriesPosition returns 1-based index', () => {
    const items = sortByDateAsc(
      [
        { id: 'a', at: new Date('2026-01-01') },
        { id: 'b', at: new Date('2026-02-01') },
        { id: 'c', at: new Date('2026-03-01') },
      ],
      (x) => x.at
    );
    expect(getSeriesPosition('b', items)).toEqual({ index: 2, total: 3 });
  });
});
