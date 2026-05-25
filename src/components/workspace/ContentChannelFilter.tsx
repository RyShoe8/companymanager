'use client';

import WorkspaceFilterSelect from '@/components/workspace/WorkspaceFilterSelect';

interface ContentChannelFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const CHANNELS = [
  'All',
  'X',
  'LinkedIn',
  'Instagram',
  'TikTok',
  'Email',
  'Article',
  'Video',
  'Reddit',
  'Bluesky',
  'Other',
] as const;

export default function ContentChannelFilter({ value, onChange }: ContentChannelFilterProps) {
  return (
    <WorkspaceFilterSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {CHANNELS.map((ch) => (
        <option key={ch} value={ch}>
          {ch === 'All' ? 'All channels' : ch}
        </option>
      ))}
    </WorkspaceFilterSelect>
  );
}
