'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';

export type CalendarStatus = {
  connected: boolean;
  calendarId: string;
  syncedAt: string | null;
};

export function buildMeetingsRangeQuery(timeframe: TimeframeType, currentDate: Date): string {
  const { start, end } = getTimeframeRange(timeframe, currentDate);
  return `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
}

export function useSchedulingCalendar(timeframe: TimeframeType, currentDate: Date) {
  const searchParams = useSearchParams();
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rangeQuery = buildMeetingsRangeQuery(timeframe, currentDate);

  const loadCalendar = useCallback(async () => {
    const res = await fetch('/api/scheduling/calendar');
    if (res.ok) setCalendar(await res.json());
  }, []);

  useEffect(() => {
    if (searchParams.get('calendar_connected')) {
      setMessage('Google Calendar connected.');
    }
    const err = searchParams.get('calendar_error');
    if (err) setMessage(`Calendar error: ${err}`);
  }, [searchParams]);

  const handleSync = useCallback(async (): Promise<{
    meetings?: unknown[];
    imported?: number;
    updated?: number;
    removed?: number;
  } | null> => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scheduling/meetings/sync?${rangeQuery}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Sync failed');
        return null;
      }
      setMessage(
        `Synced: ${data.imported || 0} new, ${data.updated || 0} updated, ${data.removed || 0} removed.`
      );
      await loadCalendar();
      return data;
    } catch {
      setMessage('Sync failed');
      return null;
    } finally {
      setSyncing(false);
    }
  }, [rangeQuery, loadCalendar]);

  const handleDisconnect = useCallback(async () => {
    await fetch('/api/scheduling/google/disconnect', { method: 'POST' });
    await loadCalendar();
    setMessage('Calendar disconnected.');
  }, [loadCalendar]);

  return {
    calendar,
    syncing,
    message,
    setMessage,
    loadCalendar,
    handleSync,
    handleDisconnect,
  };
}
