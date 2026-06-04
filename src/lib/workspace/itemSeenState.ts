type ItemSeenState = {
  signatures: Record<string, string>;
  activityMs: Record<string, number>;
  seenMs: Record<string, number>;
};

type ItemObservation = {
  key: string;
  signature: string;
  baseActivityMs: number;
};

type ObservationResult = {
  activityByKey: Record<string, number>;
  isNewByKey: Record<string, boolean>;
  changed: boolean;
};

const PREFIX = 'nucleas-item-seen:v1:';

function storageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

function emptyState(): ItemSeenState {
  return { signatures: {}, activityMs: {}, seenMs: {} };
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

  for (const item of items) {
    const priorSignature = state.signatures[item.key];
    if (priorSignature == null) {
      const activity = Math.max(0, item.baseActivityMs);
      state.signatures[item.key] = item.signature;
      state.activityMs[item.key] = activity;
      state.seenMs[item.key] = activity;
      changed = true;
      continue;
    }

    if (priorSignature !== item.signature) {
      state.signatures[item.key] = item.signature;
      state.activityMs[item.key] = Math.max(item.baseActivityMs, now);
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
  for (const item of items) {
    const activity = state.activityMs[item.key] ?? 0;
    const seen = state.seenMs[item.key] ?? activity;
    activityByKey[item.key] = activity;
    isNewByKey[item.key] = activity > seen;
  }
  return { activityByKey, isNewByKey, changed };
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
): Pick<ObservationResult, 'activityByKey' | 'isNewByKey'> {
  const state = loadState(userId);
  const activityByKey: Record<string, number> = {};
  const isNewByKey: Record<string, boolean> = {};
  for (const key of keys) {
    const activity = state.activityMs[key] ?? 0;
    const seen = state.seenMs[key] ?? activity;
    activityByKey[key] = activity;
    isNewByKey[key] = activity > seen;
  }
  return { activityByKey, isNewByKey };
}
