'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';
import {
  canStartMeetingSync,
  getMeetingSyncRetryMessage,
  recordMeetingSync,
} from '@/lib/scheduling/meetingSyncRateLimit';

export type CalendarStatus = {
  connected: boolean;
  calendarId: string;
  syncedAt: string | null;
};

const MEETING_SYNC_STORAGE_KEY = 'nucleas-meeting-sync-times';

function readStoredSyncTimestamps(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(MEETING_SYNC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'number') : [];
  } catch {
    return [];
  }
}

function writeStoredSyncTimestamps(timestamps: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(MEETING_SYNC_STORAGE_KEY, JSON.stringify(timestamps));
  } catch {
    // Ignore quota / private-mode storage errors.
  }
}

export function buildMeetingsRangeQuery(timeframe: TimeframeType, currentDate: Date): string {
  const { start, end } = getTimeframeRange(timeframe, currentDate);
  return `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
}

export function useSchedulingCalendar(
  timeframe: TimeframeType,
  currentDate: Date,
  options?: { onSyncBlocked?: () => void; onCalendarConnectedRedirect?: () => void }
) {
  const searchParams = useSearchParams();
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rangeQuery = buildMeetingsRangeQuery(timeframe, currentDate);
  const onSyncBlocked = options?.onSyncBlocked;
  const onCalendarConnectedRedirect = options?.onCalendarConnectedRedirect;

  const loadCalendar = useCallback(async () => {
    const res = await fetch('/api/scheduling/calendar');
    if (res.ok) setCalendar(await res.json());
  }, []);

  useEffect(() => {
    if (searchParams.get('calendar_connected')) {
      setMessage('Google Calendar connected.');
      onCalendarConnectedRedirect?.();
    }
    const err = searchParams.get('calendar_error');
    if (err) setMessage(`Calendar error: ${err}`);
  }, [searchParams, onCalendarConnectedRedirect]);

  const handleSync = useCallback(async (): Promise<{
    meetings?: unknown[];
    imported?: number;
    updated?: number;
    removed?: number;
  } | null> => {
    const storedTimestamps = readStoredSyncTimestamps();
    if (!canStartMeetingSync(storedTimestamps)) {
      setMessage(getMeetingSyncRetryMessage(storedTimestamps));
      onSyncBlocked?.();
      return null;
    }

    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scheduling/meetings/sync?${rangeQuery}&mode=ensureHorizon`);
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Sync failed');
        if (res.status === 429) {
          onSyncBlocked?.();
        }
        return null;
      }
      const updatedTimestamps = recordMeetingSync(storedTimestamps);
      writeStoredSyncTimestamps(updatedTimestamps);
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
  }, [rangeQuery, loadCalendar, onSyncBlocked]);

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
