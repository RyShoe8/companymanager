import { normalizeTaskStatus } from '@/lib/projects/projectCleanup';

export type TaskRetentionCandidate = {
  status?: unknown;
  completedAt?: Date | string | null;
};

export type ContentRetentionCandidate = {
  status?: string;
  statusPublishedAt?: Date | string | null;
};

export type ProjectRetentionCandidate = {
  status?: string;
  completedAt?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isTaskEligibleForPurge(task: TaskRetentionCandidate, cutoff: Date): boolean {
  if (normalizeTaskStatus(task.status) !== 'completed') return false;
  const completedAt = toDate(task.completedAt);
  if (!completedAt) return false;
  return completedAt <= cutoff;
}

export function isContentEligibleForPurge(item: ContentRetentionCandidate, cutoff: Date): boolean {
  if (item.status !== 'published') return false;
  const publishedAt = toDate(item.statusPublishedAt);
  if (!publishedAt) return false;
  return publishedAt <= cutoff;
}

export function isProjectEligibleForPurge(project: ProjectRetentionCandidate, cutoff: Date): boolean {
  if (project.status !== 'completed') return false;
  const completedAt = toDate(project.completedAt);
  if (!completedAt) return false;
  return completedAt <= cutoff;
}

export function isLegacyRetentionCandidate(
  kind: 'task' | 'content' | 'project',
  entity: TaskRetentionCandidate | ContentRetentionCandidate | ProjectRetentionCandidate
): boolean {
  if (kind === 'task') {
    const task = entity as TaskRetentionCandidate;
    return normalizeTaskStatus(task.status) === 'completed' && !toDate(task.completedAt);
  }
  if (kind === 'content') {
    const item = entity as ContentRetentionCandidate;
    return item.status === 'published' && !toDate(item.statusPublishedAt);
  }
  const project = entity as ProjectRetentionCandidate;
  return project.status === 'completed' && !toDate(project.completedAt);
}
