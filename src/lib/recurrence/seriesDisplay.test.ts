import { describe, expect, it } from 'vitest';
import { shouldShowExtendSeries } from '@/lib/recurrence/seriesDisplay';

describe('shouldShowExtendSeries', () => {
  it('shows extend when 3 or fewer occurrences remain', () => {
    expect(shouldShowExtendSeries({ index: 8, total: 10 })).toBe(true);
    expect(shouldShowExtendSeries({ index: 9, total: 10 })).toBe(true);
    expect(shouldShowExtendSeries({ index: 10, total: 10 })).toBe(true);
  });

  it('hides extend when more than 3 occurrences remain', () => {
    expect(shouldShowExtendSeries({ index: 1, total: 10 })).toBe(false);
    expect(shouldShowExtendSeries({ index: 7, total: 10 })).toBe(false);
  });
});
