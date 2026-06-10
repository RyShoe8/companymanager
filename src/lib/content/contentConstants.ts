import type { ContentChannel, ContentStatus } from '@/lib/models/ContentItem';

/** Single source of truth for content channels/statuses (model enum, API validation, form options). */
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
