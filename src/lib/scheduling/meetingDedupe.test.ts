import { describe, expect, it } from 'vitest';
import { meetingInstanceDedupeKey, normalizeMeetingTimestampMs } from '@/lib/scheduling/meetingDedupe';

describe('meetingInstanceDedupeKey', () => {
  it('uses iCalUID only for standalone events', () => {
    const start = new Date('2026-06-10T14:00:00.000Z');
    expect(
      meetingInstanceDedupeKey({
        iCalUID: 'uid-standalone',
        start,
        end: new Date('2026-06-10T15:00:00.000Z'),
      })
    ).toBe('ical:uid-standalone');
  });

  it('includes series and start for recurring instances with iCalUID', () => {
    const start = new Date('2026-06-10T14:00:00.000Z');
    expect(
      meetingInstanceDedupeKey({
        iCalUID: 'uid-series',
        googleRecurringEventId: 'series-1',
        start,
        end: new Date('2026-06-10T15:00:00.000Z'),
      })
    ).toBe(`ical:uid-series:series-1:${normalizeMeetingTimestampMs(start)}`);
  });

  it('keeps recurring instances on different days distinct', () => {
    const seriesId = 'series-1';
    const mon = meetingInstanceDedupeKey({
      iCalUID: 'uid-series',
      googleRecurringEventId: seriesId,
      start: new Date('2026-06-08T14:00:00.000Z'),
      end: new Date('2026-06-08T15:00:00.000Z'),
    });
    const tue = meetingInstanceDedupeKey({
      iCalUID: 'uid-series',
      googleRecurringEventId: seriesId,
      start: new Date('2026-06-09T14:00:00.000Z'),
      end: new Date('2026-06-09T15:00:00.000Z'),
    });
    expect(mon).not.toBe(tue);
  });
});
