'use client';

import Button from '@/components/ui/Button';
import {
  getJoinPlatformLabel,
  type MeetingJoinPlatform,
} from '@/lib/scheduling/extractMeetingJoinUrl';
import { openMeetingPopout } from '@/lib/scheduling/openMeetingPopout';

function joinCallLabels(platform?: MeetingJoinPlatform): { full: string; compact: string } {
  const label = getJoinPlatformLabel(platform);
  if (label === 'Join Call') {
    return { full: 'Join Call', compact: 'Join' };
  }
  return { full: `Join Call — ${label}`, compact: `Join ${label}` };
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
  className = '',
}: MeetingJoinCallButtonProps) {
  const labels = joinCallLabels(joinPlatform);

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
      title={labels.full}
      className={`whitespace-nowrap ${className}`.trim()}
      onClick={handleClick}
    >
      <span className="sm:hidden">{labels.compact}</span>
      <span className="hidden sm:inline">{labels.full}</span>
    </Button>
  );
}
