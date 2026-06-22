import { getTaskCreatorEmployeeId } from '@/lib/projects/taskDeleteAuth';

export const CONTRIBUTOR_TASK_FIELDS = ['name', 'description', 'estimatedHours'] as const;

export type ContributorTaskField = (typeof CONTRIBUTOR_TASK_FIELDS)[number];

export type TaskFieldUpdateBody = {
  name?: unknown;
  description?: unknown;
  estimatedHours?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  assignedTo?: unknown;
  assignedToEmployeeId?: unknown;
  assignedToEmployeeIds?: unknown;
  status?: unknown;
};

export function parseContributorTaskFieldUpdates(body: TaskFieldUpdateBody): {
  updates: Partial<Record<ContributorTaskField, string | number>>;
  error?: string;
} {
  const updates: Partial<Record<ContributorTaskField, string | number>> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return { updates: {}, error: 'name must be a string' };
    }
    updates.name = body.name.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { updates: {}, error: 'description must be a string' };
    }
    updates.description = typeof body.description === 'string' ? body.description : '';
  }

  if (body.estimatedHours !== undefined) {
    if (body.estimatedHours !== null && typeof body.estimatedHours !== 'number') {
      return { updates: {}, error: 'estimatedHours must be a number' };
    }
    if (typeof body.estimatedHours === 'number') {
      updates.estimatedHours = body.estimatedHours;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updates: {}, error: 'At least one of name, description, or estimatedHours is required' };
  }

  return { updates };
}

export function hasRestrictedTaskFieldUpdates(body: TaskFieldUpdateBody): boolean {
  return (
    body.startDate !== undefined ||
    body.endDate !== undefined ||
    body.assignedTo !== undefined ||
    body.assignedToEmployeeId !== undefined ||
    body.assignedToEmployeeIds !== undefined ||
    body.status !== undefined
  );
}

type TaskWithCreator = {
  createdByEmployeeId?: { toString(): string } | string | null;
};

export function canContributorUpdateTaskFields(params: {
  isManagerOrAdmin: boolean;
  isAssigned: boolean;
  task: TaskWithCreator;
  currentUserEmployeeId?: string | null;
}): boolean {
  if (params.isManagerOrAdmin) return true;
  if (params.isAssigned) return true;
  const creatorId = getTaskCreatorEmployeeId(params.task);
  return !!creatorId && creatorId === params.currentUserEmployeeId;
}
