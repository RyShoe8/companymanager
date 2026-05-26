'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export type CalendarStatus = {
  connected: boolean;
  calendarId: string;
  syncedAt: string | null;
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function buildMeetingsRangeQuery(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 7);
  return `start=${encodeURIComponent(weekStart.toISOString())}&end=${encodeURIComponent(weekEnd.toISOString())}`;
}

export function useSchedulingCalendar(weekStart: Date) {
  const searchParams = useSearchParams();
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rangeQuery = buildMeetingsRangeQuery(weekStart);

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

  const handleSync = useCallback(async (): Promise<{ meetings?: unknown[]; imported?: number; updated?: number } | null> => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scheduling/meetings/sync?${rangeQuery}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Sync failed');
        return null;
      }
      setMessage(`Synced: ${data.imported || 0} new, ${data.updated || 0} updated.`);
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

export { startOfWeek, addDays };
