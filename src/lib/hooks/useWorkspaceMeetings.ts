'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IMeeting } from '@/lib/models/Meeting';
import { sortMeetingsByStart } from '@/lib/scheduling/meetingHours';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';

export function useWorkspaceMeetings(
  timeframe: TimeframeType,
  currentDate: Date,
  enabled: boolean,
  refreshKey = 0
) {
  const [meetings, setMeetings] = useState<IMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  const fetchMeetings = useCallback(async () => {
    if (!enabled) {
      setMeetings([]);
      return;
    }

    setLoadingMeetings(true);
    try {
      const { start, end } = getTimeframeRange(timeframe, currentDate);
      const params = new URLSearchParams({
        scope: 'org',
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const res = await fetch(`/api/scheduling/meetings?${params.toString()}`);
      if (!res.ok) {
        setMeetings([]);
        return;
      }
      const data = await res.json();
      setMeetings(Array.isArray(data) ? sortMeetingsByStart(data) : []);
    } catch {
      setMeetings([]);
    } finally {
      setLoadingMeetings(false);
    }
  }, [enabled, timeframe, currentDate]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings, refreshKey]);

  return { meetings, loadingMeetings, refetchMeetings: fetchMeetings };
}

export default useWorkspaceMeetings;
