export const WORKSPACE_DIGEST_INTERVALS = [
  'off',
  'immediate',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '24h',
] as const;

export type WorkspaceDigestInterval = (typeof WORKSPACE_DIGEST_INTERVALS)[number];

export const WORKSPACE_NOTIFICATION_EVENT_TYPES = [
  'task_new',
  'task_update',
  'content_new',
  'content_update',
  'project_new',
  'project_update',
] as const;

export type WorkspaceNotificationEventType = (typeof WORKSPACE_NOTIFICATION_EVENT_TYPES)[number];

export type WorkspaceEntityKind = 'task' | 'content' | 'project';

export function isWorkspaceDigestInterval(value: unknown): value is WorkspaceDigestInterval {
  return (
    typeof value === 'string' &&
    (WORKSPACE_DIGEST_INTERVALS as readonly string[]).includes(value)
  );
}

export function intervalToMinutes(interval: WorkspaceDigestInterval): number | null {
  switch (interval) {
    case 'off':
      return null;
    case 'immediate':
      return 5;
    case '1h':
      return 60;
    case '2h':
      return 120;
    case '4h':
      return 240;
    case '8h':
      return 480;
    case '12h':
      return 720;
    case '24h':
      return 1440;
    default:
      return null;
  }
}

export const DIGEST_INTERVAL_LABELS: Record<WorkspaceDigestInterval, string> = {
  off: 'Off',
  immediate: 'Immediate',
  '1h': 'Every hour',
  '2h': 'Every 2 hours',
  '4h': 'Every 4 hours',
  '8h': 'Every 8 hours',
  '12h': 'Every 12 hours',
  '24h': 'Every 24 hours',
};
