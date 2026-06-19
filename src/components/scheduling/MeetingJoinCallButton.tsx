'use client';

import Button from '@/components/ui/Button';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';
import { openMeetingPopout } from '@/lib/scheduling/openMeetingPopout';

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
  joinPlatform: _joinPlatform,
  agendaToken,
  onPopoutBlocked,
  size = 'sm',
  className = '',
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
      title="Join Call"
      className={`whitespace-nowrap ${className}`.trim()}
      onClick={handleClick}
    >
      <span className="sm:hidden">Join</span>
      <span className="hidden sm:inline">Join Call</span>
    </Button>
  );
}
