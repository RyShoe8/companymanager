import { describe, expect, it } from 'vitest';
import { estimateSearchApiMicros } from '@/lib/ai/pricing/searchApiRates';

describe('estimateSearchApiMicros', () => {
  it('stays zero while under free tiers', () => {
    expect(
      estimateSearchApiMicros({
        braveQueries: 100,
        googleCseQueries: 50,
        dayOfMonth: 10,
      })
    ).toBe(0);
  });

  it('bills Brave after monthly free allotment', () => {
    // default 2000 free; 2100 → 100 billable × $5/1000 = $0.50 = 500_000 micros
    expect(
      estimateSearchApiMicros({
        braveQueries: 2100,
        googleCseQueries: 0,
        dayOfMonth: 1,
      })
    ).toBe(500_000);
  });

  it('approximates Google daily free pool by day-of-month', () => {
    // day 2 → 200 free; 250 queries → 50 billable × 5000 micros = 250_000
    expect(
      estimateSearchApiMicros({
        braveQueries: 0,
        googleCseQueries: 250,
        dayOfMonth: 2,
      })
    ).toBe(250_000);
  });
});
