const LAST_SEEN_PREFIX = 'nucleas-comment-last-seen:';
const MANUALLY_COLLAPSED_KEY = 'nucleas-comment-manually-collapsed';

export function buildCommentThreadKey(
  userId: string,
  entityType: 'project' | 'projectTask' | 'contentItem',
  entityId: string,
  taskId?: string | null
): string {
  return `${userId}:${entityType}:${entityId}:${taskId ?? ''}`;
}

function lastSeenStorageKey(threadKey: string): string {
  return `${LAST_SEEN_PREFIX}${threadKey}`;
}

function getCommentLastSeenMs(threadKey: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(lastSeenStorageKey(threadKey));
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setCommentLastSeenMs(threadKey: string, ms: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(lastSeenStorageKey(threadKey), String(ms));
}

function loadManuallyCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem(MANUALLY_COLLAPSED_KEY);
    if (!saved) return new Set();
    const ids = JSON.parse(saved) as string[];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveManuallyCollapsed(collapsed: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MANUALLY_COLLAPSED_KEY, JSON.stringify(Array.from(collapsed)));
}

function isCommentThreadManuallyCollapsed(threadKey: string): boolean {
  return loadManuallyCollapsed().has(threadKey);
}

export function setCommentThreadManuallyCollapsed(threadKey: string, collapsed: boolean): void {
  const set = loadManuallyCollapsed();
  if (collapsed) set.add(threadKey);
  else set.delete(threadKey);
  saveManuallyCollapsed(set);
}

/** True when there is stored last-seen and activity is newer (unread). */
export function hasUnreadCommentActivity(
  threadKey: string,
  latestActivityMs: number
): boolean {
  if (latestActivityMs <= 0) return false;
  const lastSeen = getCommentLastSeenMs(threadKey);
  if (lastSeen == null) return false;
  return latestActivityMs > lastSeen;
}

/** True when thread should auto-expand on return. */
export function shouldAutoExpandCommentThread(
  threadKey: string,
  latestActivityMs: number
): boolean {
  if (latestActivityMs <= 0) return false;
  if (isCommentThreadManuallyCollapsed(threadKey)) return false;
  const lastSeen = getCommentLastSeenMs(threadKey);
  if (lastSeen == null) return true;
  return latestActivityMs > lastSeen;
}
