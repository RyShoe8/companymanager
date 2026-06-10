'use client';

import Button from '@/components/ui/Button';
import {
  getJoinPlatformLabel,
  type MeetingJoinPlatform,
} from '@/lib/scheduling/extractMeetingJoinUrl';

function joinCallLabel(platform?: MeetingJoinPlatform): string {
  const label = getJoinPlatformLabel(platform);
  return label === 'Join Call' ? 'Join Call' : `Join Call — ${label}`;
}

interface MeetingJoinCallButtonProps {
  joinUrl: string;
  joinPlatform?: MeetingJoinPlatform;
  size?: 'sm' | 'md';
  className?: string;
}

export default function MeetingJoinCallButton({
  joinUrl,
  joinPlatform,
  size = 'sm',
  className,
}: MeetingJoinCallButtonProps) {
  return (
    <a
      href={joinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex ${className ?? ''}`}
    >
      <Button type="button" size={size} variant="secondary">
        {joinCallLabel(joinPlatform)}
      </Button>
    </a>
  );
}
