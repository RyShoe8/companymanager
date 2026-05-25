import type { IEmployee } from '@/lib/models/Employee';
import type { IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { getTaskAssigneeEmployeeIds } from '@/lib/utils/projectTeam';

export function resolveEmployeeName(
  employees: IEmployee[],
  employeeId?: string,
  legacyName?: string
): string | undefined {
  if (legacyName) return legacyName;
  if (employeeId) {
    const employee = employees.find((emp) => emp._id?.toString() === employeeId);
    return employee?.name;
  }
  return undefined;
}

export function formatTaskAssigneeLabel(task: IProjectTask, employees: IEmployee[]): string | undefined {
  const ids = getTaskAssigneeEmployeeIds(task);
  const names = ids
    .map((id) => resolveEmployeeName(employees, id, undefined))
    .filter((name): name is string => Boolean(name));
  if (names.length > 0) return names.join(', ');
  return resolveEmployeeName(
    employees,
    (task as { assignedToEmployeeId?: { toString(): string } }).assignedToEmployeeId?.toString(),
    task.assignedTo
  );
}

export function formatContentAssigneeLabel(item: IContentItem, employees: IEmployee[]): string | undefined {
  return resolveEmployeeName(employees, item.assignedToEmployeeId?.toString(), undefined);
}

export function contentPassesAssignmentFilter(
  item: IContentItem,
  options: {
    showOnlyMyAssignments: boolean;
    isManagerOrAdmin: boolean;
    currentUserEmployeeId: string | null;
    currentUserEmployeeName: string | null;
    currentUserRole?: 'Administrator' | 'Manager' | 'User';
  }
): boolean {
  const assigneeId = item.assignedToEmployeeId?.toString();
  const restrictToMine =
    options.currentUserRole === 'User' ||
    (options.showOnlyMyAssignments &&
      (options.currentUserEmployeeName || options.currentUserEmployeeId));

  if (!restrictToMine) {
    if (options.isManagerOrAdmin) return true;
    if (options.currentUserEmployeeId && assigneeId === options.currentUserEmployeeId) return true;
    return !options.currentUserEmployeeId && !options.currentUserEmployeeName;
  }

  if (!options.currentUserEmployeeName && !options.currentUserEmployeeId) return true;
  if (options.currentUserEmployeeId && assigneeId === options.currentUserEmployeeId) return true;
  return false;
}

export function taskPassesAssignmentFilter(
  task: IProjectTask,
  options: {
    showOnlyMyAssignments: boolean;
    isManagerOrAdmin: boolean;
    currentUserEmployeeId: string | null;
    currentUserEmployeeName: string | null;
    currentUserRole?: 'Administrator' | 'Manager' | 'User';
  }
): boolean {
  const assigneeIds = getTaskAssigneeEmployeeIds(task);
  const restrictToMine =
    options.currentUserRole === 'User' ||
    (options.showOnlyMyAssignments &&
      (options.currentUserEmployeeName || options.currentUserEmployeeId));

  if (!restrictToMine) {
    if (options.isManagerOrAdmin) return true;
    if (options.currentUserEmployeeId && assigneeIds.includes(options.currentUserEmployeeId)) return true;
    return task.assignedTo === options.currentUserEmployeeName;
  }

  if (!options.currentUserEmployeeName && !options.currentUserEmployeeId) return true;
  if (options.currentUserEmployeeId && assigneeIds.includes(options.currentUserEmployeeId)) return true;
  return task.assignedTo === options.currentUserEmployeeName;
}
