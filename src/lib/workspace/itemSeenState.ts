import type { IContentItem } from '@/lib/models/ContentItem';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import { getTaskAssigneeEmployeeIds } from '@/lib/utils/projectTeam';

type ItemSeenState = {
  signatures: Record<string, string>;
  activityMs: Record<string, number>;
  seenMs: Record<string, number>;
  kindByKey: Record<string, 'new' | 'updated'>;
  initializedAtMs: number;
};

export type ItemObservation = {
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

export function buildTaskItemSignature(
  task: IProjectTask,
  options?: { commentActivityMs?: number }
): string {
  const taskId = (task as { _id?: { toString(): string } })._id?.toString() ?? '';
  return JSON.stringify({
    taskId,
    name: task.name,
    description: task.description ?? '',
    startDate: task.startDate,
    endDate: task.endDate,
    estimatedHours: task.estimatedHours ?? null,
    status: task.status ?? '',
    assigned: getTaskAssigneeEmployeeIds(task).sort(),
    recurrenceSeriesId: task.recurrenceSeriesId ?? '',
    commentActivityMs: options?.commentActivityMs ?? 0,
  });
}

export function buildContentItemSignature(
  item: IContentItem,
  options?: { commentActivityMs?: number }
): string {
  return JSON.stringify({
    updatedAt: item.updatedAt ?? '',
    createdAt: item.createdAt ?? '',
    title: item.title,
    channel: item.channel,
    status: item.status,
    publishDate: item.publishDate ?? '',
    estimatedHours: item.estimatedHours ?? null,
    assignedToEmployeeId: item.assignedToEmployeeId?.toString() ?? '',
    notes: item.notes ?? '',
    commentActivityMs: options?.commentActivityMs ?? 0,
  });
}

export function buildTaskItemObservation(
  project: IProject,
  task: IProjectTask,
  taskIndex: number,
  options?: { commentActivityMs?: number }
): ItemObservation {
  const projectId = project._id.toString();
  const taskId = (task as { _id?: { toString(): string } })._id?.toString() ?? null;
  const commentActivityMs = options?.commentActivityMs ?? 0;
  return {
    key: buildTaskItemKey(projectId, taskId, taskIndex),
    signature: buildTaskItemSignature(task, { commentActivityMs }),
    baseActivityMs: Math.max(
      new Date((project as { updatedAt?: Date | string }).updatedAt ?? project.createdAt).getTime(),
      commentActivityMs
    ),
  };
}

export function buildContentItemObservation(
  item: IContentItem,
  options?: { commentActivityMs?: number; projectCreatedAt?: Date | string }
): ItemObservation {
  const projectId = item.projectId?.toString() ?? 'none';
  const commentActivityMs = options?.commentActivityMs ?? 0;
  const fallbackCreatedAt = options?.projectCreatedAt ?? item.createdAt ?? new Date();
  return {
    key: buildContentItemKey(projectId, item._id.toString()),
    signature: buildContentItemSignature(item, { commentActivityMs }),
    baseActivityMs: Math.max(
      new Date(item.updatedAt ?? item.createdAt ?? fallbackCreatedAt).getTime(),
      commentActivityMs
    ),
  };
}

export function collectWorkspaceItemObservations(
  projects: IProject[],
  contentItems: IContentItem[]
): ItemObservation[] {
  const taskEntries = projects.flatMap((project) =>
    (project.tasks ?? []).map((task, idx) => buildTaskItemObservation(project, task, idx))
  );
  const contentEntries = contentItems.map((item) => buildContentItemObservation(item));
  return [...taskEntries, ...contentEntries];
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
  const now = Date.now();
  const taskPrefix = `task:${projectId}:`;
  const contentPrefix = `content:${projectId}:`;

  for (const [key, activityMs] of Object.entries(state.activityMs)) {
    if (!key.startsWith(taskPrefix) && !key.startsWith(contentPrefix)) continue;
    const nextSeen = Math.max(state.seenMs[key] ?? 0, activityMs, now);
    if (nextSeen !== (state.seenMs[key] ?? 0)) {
      state.seenMs[key] = nextSeen;
      changed = true;
    }
    if (key in state.kindByKey) {
      delete state.kindByKey[key];
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
