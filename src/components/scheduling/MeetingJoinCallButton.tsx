'use client';

import Button from '@/components/ui/Button';
import {
  getJoinPlatformLabel,
  type MeetingJoinPlatform,
} from '@/lib/scheduling/extractMeetingJoinUrl';
import { openMeetingPopout } from '@/lib/scheduling/openMeetingPopout';

function joinCallLabel(platform?: MeetingJoinPlatform): string {
  const label = getJoinPlatformLabel(platform);
  return label === 'Join Call' ? 'Join Call' : `Join Call — ${label}`;
}

interface MeetingJoinCallButtonProps {
  joinUrl: string;
  joinPlatform?: MeetingJoinPlatform;
  agendaToken?: string;
  onPopoutBlocked?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export default function MeetingJoinCallButton({
  joinUrl,
  joinPlatform,
  agendaToken,
  onPopoutBlocked,
  size = 'sm',
  className,
}: MeetingJoinCallButtonProps) {
  const handleClick = () => {
    window.open(joinUrl, '_blank', 'noopener,noreferrer');

    if (agendaToken) {
      const result = openMeetingPopout(agendaToken);
      if (result.blocked) {
        onPopoutBlocked?.();
      }
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant="secondary"
      className={className}
      onClick={handleClick}
    >
      {joinCallLabel(joinPlatform)}
    </Button>
  );
}
