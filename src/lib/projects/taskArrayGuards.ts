/** Maximum tasks that can be added in one POST append without bulk expand. */
export const MAX_TASK_APPEND = 20;

/** Maximum increase in task count on PUT without bulk expand. */
export const MAX_TASK_COUNT_INCREASE = 20;

export function taskIdString(task: { _id?: unknown }): string | null {
  if (task._id == null) return null;
  const id = task._id;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id && typeof (id as { toString?: () => string }).toString === 'function') {
    return (id as { toString: () => string }).toString();
  }
  return null;
}

export function findDuplicateTaskIds(tasks: unknown[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const task of tasks) {
    if (!task || typeof task !== 'object') continue;
    const id = taskIdString(task as { _id?: unknown });
    if (!id) continue;
    if (seen.has(id)) duplicates.push(id);
    else seen.add(id);
  }
  return duplicates;
}

export type ValidateTaskArrayOptions = {
  previousCount: number;
  incomingTasks: unknown[];
  allowBulkTaskExpand?: boolean;
  /** When true, incomingTasks is only the new tasks being appended (POST). */
  isAppend?: boolean;
};

export function validateIncomingTaskArray(options: ValidateTaskArrayOptions): string | null {
  const { previousCount, incomingTasks, allowBulkTaskExpand, isAppend } = options;

  const duplicateIds = findDuplicateTaskIds(incomingTasks);
  if (duplicateIds.length > 0) {
    return `Duplicate task IDs in request: ${duplicateIds.join(', ')}`;
  }

  if (allowBulkTaskExpand) return null;

  if (isAppend) {
    if (incomingTasks.length > MAX_TASK_APPEND) {
      return `Cannot append more than ${MAX_TASK_APPEND} tasks at once.`;
    }
    return null;
  }

  const delta = incomingTasks.length - previousCount;
  if (delta > MAX_TASK_COUNT_INCREASE) {
    return `Task count increased by ${delta}; maximum allowed is ${MAX_TASK_COUNT_INCREASE} without bulk expand.`;
  }

  return null;
}

export function taskDedupeSignature(task: Record<string, unknown>): string {
  const assignees = Array.isArray(task.assignedToEmployeeIds)
    ? [...task.assignedToEmployeeIds].map(String).sort()
    : task.assignedToEmployeeId
      ? [String(task.assignedToEmployeeId)]
      : [];

  const startDate =
    task.startDate != null
      ? new Date(task.startDate as string | Date).toISOString().slice(0, 10)
      : '';
  const endDate =
    task.endDate != null ? new Date(task.endDate as string | Date).toISOString().slice(0, 10) : '';

  return JSON.stringify({
    name: typeof task.name === 'string' ? task.name.trim() : '',
    status: task.status ?? 'active',
    startDate,
    endDate,
    description: task.description ?? '',
    assignees,
    recurrenceSeriesId: task.recurrenceSeriesId ?? '',
  });
}

/** Keep the first task for each normalized signature (oldest in array order). */
export function dedupeProjectTasks<T extends Record<string, unknown>>(tasks: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const task of tasks) {
    const sig = taskDedupeSignature(task);
    if (seen.has(sig)) continue;
    seen.add(sig);
    result.push(task);
  }
  return result;
}
