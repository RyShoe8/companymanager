'use client';

import Button from '@/components/ui/Button';
import type { CalendarStatus } from '@/hooks/scheduling/useSchedulingCalendar';

interface SchedulingCalendarBarProps {
  calendar: CalendarStatus | null;
  syncing: boolean;
  onSync: () => void;
}

export default function SchedulingCalendarBar({
  calendar,
  syncing,
  onSync,
}: SchedulingCalendarBarProps) {
  if (calendar?.connected) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <span className="text-primary font-medium">Calendar connected</span>
        {calendar.syncedAt && (
          <span className="text-text-muted hidden sm:inline">
            Last sync: {new Date(calendar.syncedAt).toLocaleString()}
          </span>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={onSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync meetings'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-text-secondary hidden md:inline">
        Connect Google Calendar to import meetings
      </span>
      <a
        href="/api/scheduling/google/connect"
        className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        Connect Google Calendar
      </a>
    </div>
  );
}
