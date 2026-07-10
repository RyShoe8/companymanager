'use client';

import SchedulingStatusBar from '@/components/scheduling/SchedulingStatusBar';
import type { CalendarStatus } from '@/hooks/scheduling/useSchedulingCalendar';

interface SchedulingCalendarBarProps {
  calendar: CalendarStatus | null;
  syncing: boolean;
  onSync: () => void;
  flashMessage?: string | null;
  onDismissFlash?: () => void;
}

export default function SchedulingCalendarBar({
  calendar,
  syncing,
  onSync,
  flashMessage,
  onDismissFlash,
}: SchedulingCalendarBarProps) {
  return (
    <SchedulingStatusBar
      calendar={calendar}
      syncing={syncing}
      onSync={onSync}
      flashMessage={flashMessage}
      onDismissFlash={onDismissFlash}
      className="py-2"
    />
  );
}
