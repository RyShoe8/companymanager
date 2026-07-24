const LAST_SEEN_PREFIX = 'nucleas-comment-last-seen:';
const MANUALLY_COLLAPSED_KEY = 'nucleas-comment-manually-collapsed';
const MAX_LAST_SEEN_KEYS = 300;
const MAX_COLLAPSED_KEYS = 200;

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

function pruneCommentLastSeenKeys(): void {
  if (typeof window === 'undefined') return;
  const entries: { key: string; ms: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(LAST_SEEN_PREFIX)) continue;
    const ms = Number(localStorage.getItem(key));
    entries.push({ key, ms: Number.isFinite(ms) ? ms : 0 });
  }
  if (entries.length <= MAX_LAST_SEEN_KEYS) return;
  entries
    .sort((a, b) => a.ms - b.ms)
    .slice(0, entries.length - MAX_LAST_SEEN_KEYS)
    .forEach(({ key }) => localStorage.removeItem(key));
}

export function setCommentLastSeenMs(threadKey: string, ms: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(lastSeenStorageKey(threadKey), String(ms));
  pruneCommentLastSeenKeys();
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
  let ids = Array.from(collapsed);
  if (ids.length > MAX_COLLAPSED_KEYS) {
    ids = ids.slice(ids.length - MAX_COLLAPSED_KEYS);
  }
  localStorage.setItem(MANUALLY_COLLAPSED_KEY, JSON.stringify(ids));
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
