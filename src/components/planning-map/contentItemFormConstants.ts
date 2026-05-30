import { ContentChannel, ContentStatus } from '@/lib/models/ContentItem';

export const CONTENT_CHANNELS: ContentChannel[] = [
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

export const CONTENT_STATUSES: ContentStatus[] = [
  'idea',
  'planned',
  'in_progress',
  'ready',
  'published',
];

export function toContentInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
