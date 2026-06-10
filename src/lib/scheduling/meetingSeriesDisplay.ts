'use client';

import { useMemo } from 'react';
import type { IMeeting } from '@/lib/models/Meeting';
import { getSeriesPosition, sortByDateAsc } from '@/lib/recurrence/recurrenceHorizons';

export function getMeetingSeriesPosition(
  meeting: Pick<IMeeting, '_id' | 'googleRecurringEventId' | 'start'>,
  allMeetings: Pick<IMeeting, '_id' | 'googleRecurringEventId' | 'start'>[],
  seriesTotalCount?: number
): { index: number; total: number } | null {
  const seriesId = meeting.googleRecurringEventId;
  if (!seriesId) return null;

  const series = allMeetings.filter((m) => m.googleRecurringEventId === seriesId);
  const sorted = sortByDateAsc(series, (m) => new Date(m.start));
  const id = meeting._id.toString();
  const position = getSeriesPosition(
    id,
    sorted.map((m) => ({ id: m._id.toString() }))
  );

  if (seriesTotalCount != null && seriesTotalCount > 0) {
    return { index: position.index, total: seriesTotalCount };
  }
  return position;
}

export function useMeetingSeriesTotals(
  meetings: Pick<IMeeting, 'googleRecurringEventId'>[],
  recurrenceCounts?: Record<string, number>
): Record<string, number> {
  return useMemo(() => {
    const totals: Record<string, number> = { ...(recurrenceCounts ?? {}) };
    for (const m of meetings) {
      const sid = m.googleRecurringEventId;
      if (!sid || totals[sid]) continue;
      const count = meetings.filter((x) => x.googleRecurringEventId === sid).length;
      totals[sid] = count;
    }
    return totals;
  }, [meetings, recurrenceCounts]);
}
