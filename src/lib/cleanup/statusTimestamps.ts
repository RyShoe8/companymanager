import { normalizeTaskStatus } from '@/lib/projects/projectCleanup';

export function resolveTaskCompletedAt(
  previousStatus: unknown,
  nextStatus: 'active' | 'completed' | 'in-review',
  existingCompletedAt?: Date | null
): Date | undefined {
  if (nextStatus !== 'completed') return undefined;
  if (normalizeTaskStatus(previousStatus) === 'completed' && existingCompletedAt) {
    return existingCompletedAt;
  }
  return new Date();
}

export function resolveProjectCompletedAt(
  previousStatus: unknown,
  nextStatus: string,
  existingCompletedAt?: Date | null
): Date | undefined {
  if (nextStatus !== 'completed') return undefined;
  if (String(previousStatus) === 'completed' && existingCompletedAt) {
    return existingCompletedAt;
  }
  return new Date();
}

export function resolveStatusPublishedAt(
  previousStatus: unknown,
  nextStatus: string,
  existingStatusPublishedAt?: Date | null
): Date | undefined {
  if (nextStatus !== 'published') return undefined;
  if (String(previousStatus) === 'published' && existingStatusPublishedAt) {
    return existingStatusPublishedAt;
  }
  return new Date();
}
