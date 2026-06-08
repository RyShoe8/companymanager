type ItemSeenState = {
  signatures: Record<string, string>;
  activityMs: Record<string, number>;
  seenMs: Record<string, number>;
  kindByKey: Record<string, 'new' | 'updated'>;
  initializedAtMs: number;
};

type ItemObservation = {
  key: string;
  signature: string;
  baseActivityMs: number;
};

type ObservationResult = {
  activityByKey: Record<string, number>;
  isNewByKey: Record<string, boolean>;
  statusByKey: Record<string, ItemSeenStatus>;
  changed: boolean;
};

export type ItemSeenStatus = 'new' | 'updated' | 'none';

const PREFIX = 'nucleas-item-seen:v1:';

function storageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

function emptyState(): ItemSeenState {
  return { signatures: {}, activityMs: {}, seenMs: {}, kindByKey: {}, initializedAtMs: 0 };
}

function loadState(userId: string): ItemSeenState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ItemSeenState>;
    return {
      signatures: parsed.signatures ?? {},
      activityMs: parsed.activityMs ?? {},
      seenMs: parsed.seenMs ?? {},
      kindByKey: parsed.kindByKey ?? {},
      initializedAtMs: Number.isFinite(parsed.initializedAtMs) ? (parsed.initializedAtMs as number) : 0,
    };
  } catch {
    return emptyState();
  }
}

function saveState(userId: string, state: ItemSeenState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function buildTaskItemKey(projectId: string, taskId: string | null, taskIndex: number): string {
  return `task:${projectId}:${taskId ?? `index:${taskIndex}`}`;
}

export function buildContentItemKey(projectId: string, contentItemId: string): string {
  return `content:${projectId}:${contentItemId}`;
}

export function observeItemsForUser(userId: string, items: ItemObservation[]): ObservationResult {
  const state = loadState(userId);
  let changed = false;
  const now = Date.now();
  const firstObservation = state.initializedAtMs <= 0;
  if (firstObservation) {
    state.initializedAtMs = now;
    changed = true;
  }

  for (const item of items) {
    const priorSignature = state.signatures[item.key];
    if (priorSignature == null) {
      const activity = firstObservation
        ? Math.max(0, item.baseActivityMs)
        : Math.max(item.baseActivityMs, now);
      state.signatures[item.key] = item.signature;
      state.activityMs[item.key] = activity;
      if (firstObservation) {
        state.seenMs[item.key] = activity;
      } else {
        state.kindByKey[item.key] = 'new';
      }
      changed = true;
      continue;
    }

    if (priorSignature !== item.signature) {
      state.signatures[item.key] = item.signature;
      state.activityMs[item.key] = Math.max(item.baseActivityMs, now);
      state.kindByKey[item.key] = 'updated';
      changed = true;
    } else if (!(item.key in state.activityMs)) {
      state.activityMs[item.key] = Math.max(0, item.baseActivityMs);
      changed = true;
    }
  }

  if (changed) {
    saveState(userId, state);
  }

  const activityByKey: Record<string, number> = {};
  const isNewByKey: Record<string, boolean> = {};
  const statusByKey: Record<string, ItemSeenStatus> = {};
  for (const item of items) {
    const activity = state.activityMs[item.key] ?? 0;
    const seen = state.seenMs[item.key] ?? activity;
    const unseen = activity > seen;
    activityByKey[item.key] = activity;
    isNewByKey[item.key] = unseen;
    statusByKey[item.key] = unseen ? (state.kindByKey[item.key] ?? 'updated') : 'none';
  }
  return { activityByKey, isNewByKey, statusByKey, changed };
}

export function markProjectItemsSeen(userId: string, projectId: string): boolean {
  const state = loadState(userId);
  let changed = false;
  const taskPrefix = `task:${projectId}:`;
  const contentPrefix = `content:${projectId}:`;

  for (const [key, activityMs] of Object.entries(state.activityMs)) {
    if (!key.startsWith(taskPrefix) && !key.startsWith(contentPrefix)) continue;
    if ((state.seenMs[key] ?? 0) < activityMs) {
      state.seenMs[key] = activityMs;
      changed = true;
    }
  }

  if (changed) {
    saveState(userId, state);
  }
  return changed;
}

export function readObservedItemsForUser(
  userId: string,
  keys: string[]
): Pick<ObservationResult, 'activityByKey' | 'isNewByKey' | 'statusByKey'> {
  const state = loadState(userId);
  const activityByKey: Record<string, number> = {};
  const isNewByKey: Record<string, boolean> = {};
  const statusByKey: Record<string, ItemSeenStatus> = {};
  for (const key of keys) {
    const activity = state.activityMs[key] ?? 0;
    const seen = state.seenMs[key] ?? activity;
    const unseen = activity > seen;
    activityByKey[key] = activity;
    isNewByKey[key] = unseen;
    statusByKey[key] = unseen ? (state.kindByKey[key] ?? 'updated') : 'none';
  }
  return { activityByKey, isNewByKey, statusByKey };
}
