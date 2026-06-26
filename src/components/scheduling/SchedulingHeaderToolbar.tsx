'use client';

import Button from '@/components/ui/Button';
import ActionMenu from '@/components/ui/ActionMenu';
import type { CalendarStatus } from '@/hooks/scheduling/useSchedulingCalendar';

interface SchedulingHeaderToolbarProps {
  calendar: CalendarStatus | null;
  syncing: boolean;
  onSync: () => void;
  onSetAvailability: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export default function SchedulingHeaderToolbar({
  calendar,
  syncing,
  onSync,
  onSetAvailability,
  onDisconnect,
  className = '',
}: SchedulingHeaderToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 min-w-0 ${className}`}>
      {calendar?.connected ? (
        <>
          <span className="text-xs sm:text-sm font-medium text-primary shrink-0">Connected</span>
          {calendar.syncedAt ? (
            <span className="text-xs text-text-muted hidden sm:inline truncate max-w-[12rem]">
              {new Date(calendar.syncedAt).toLocaleString()}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onSync}
            disabled={syncing}
            className="shrink-0"
          >
            {syncing ? 'Syncing…' : 'Sync meetings'}
          </Button>
        </>
      ) : (
        <a
          href="/api/scheduling/google/connect"
          className="inline-flex shrink-0 items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Connect Calendar
        </a>
      )}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onSetAvailability}
        className="shrink-0"
      >
        Availability
      </Button>
      {calendar?.connected && onDisconnect ? (
        <ActionMenu
          align="right"
          width="w-44"
          trigger={({ toggle }) => (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={toggle}
              className="shrink-0 px-2.5"
              aria-label="More scheduling options"
            >
              ⋯
            </Button>
          )}
          items={[{ label: 'Disconnect calendar', onClick: onDisconnect }]}
        />
      ) : null}
    </div>
  );
}
