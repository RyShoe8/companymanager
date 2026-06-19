import type { ContentChannel } from '@/lib/models/ContentItem';

export function matchContentChannel(raw: string | undefined): ContentChannel | null {
  if (!raw?.trim()) return null;
  const n = raw.trim().toLowerCase();
  const channels: ContentChannel[] = [
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
  ];
  const hit = channels.find((c) => c.toLowerCase() === n);
  return hit ?? null;
}
