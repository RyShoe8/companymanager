import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeMeetingTimestampMs } from '@/lib/scheduling/meetingDedupe';

const updateMany = vi.fn();

vi.mock('@/lib/models/Meeting', () => ({
  default: {
    updateMany: (...args: unknown[]) => updateMany(...args),
  },
}));

import { propagateMeetingInstanceAfterLocalEdit } from '@/lib/scheduling/propagateMeetingInstance';

describe('propagateMeetingInstanceAfterLocalEdit', () => {
  beforeEach(() => {
    updateMany.mockReset();
    updateMany.mockResolvedValue({ modifiedCount: 2 });
  });

  it('scopes recurring updates to the previous start minute', async () => {
    const previousStart = new Date('2026-06-08T14:00:00.000Z');
    const previousEnd = new Date('2026-06-08T15:00:00.000Z');
    const newStart = new Date('2026-06-09T14:00:00.000Z');
    const newEnd = new Date('2026-06-09T15:00:00.000Z');

    const count = await propagateMeetingInstanceAfterLocalEdit({
      organizationId: 'org-1',
      iCalUID: 'uid-series',
      googleRecurringEventId: 'series-1',
      previousStart,
      previousEnd,
      fields: {
        title: 'Standup',
        start: newStart,
        end: newEnd,
        googleRecurringEventId: 'series-1',
      },
    });

    expect(count).toBe(2);
    const [filter] = updateMany.mock.calls[0];
    expect(filter).toMatchObject({
      organizationId: 'org-1',
      iCalUID: 'uid-series',
      googleRecurringEventId: 'series-1',
    });
    const oldStartMs = normalizeMeetingTimestampMs(previousStart);
    expect(filter.start).toEqual({
      $gte: new Date(oldStartMs),
      $lt: new Date(oldStartMs + 60_000),
    });
  });

  it('returns 0 when iCalUID is missing', async () => {
    const count = await propagateMeetingInstanceAfterLocalEdit({
      organizationId: 'org-1',
      previousStart: new Date(),
      previousEnd: new Date(),
      fields: {
        title: 'x',
        start: new Date(),
        end: new Date(),
      },
    });
    expect(count).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
