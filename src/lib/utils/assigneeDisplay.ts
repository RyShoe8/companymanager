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

function agendaDisplayName(
  name: string,
  employeeId: string | undefined,
  currentUserEmployeeId: string | null,
  currentUserEmployeeName: string | null
): string {
  if (currentUserEmployeeId && employeeId === currentUserEmployeeId) return 'You';
  if (currentUserEmployeeName && name === currentUserEmployeeName) return 'You';
  return name;
}

export function formatAgendaAssigneeDisplay(
  employees: IEmployee[],
  currentUserEmployeeId: string | null,
  currentUserEmployeeName: string | null,
  task: IProjectTask
): string | undefined;
export function formatAgendaAssigneeDisplay(
  employees: IEmployee[],
  currentUserEmployeeId: string | null,
  currentUserEmployeeName: string | null,
  item: IContentItem
): string | undefined;
export function formatAgendaAssigneeDisplay(
  employees: IEmployee[],
  currentUserEmployeeId: string | null,
  currentUserEmployeeName: string | null,
  taskOrItem: IProjectTask | IContentItem
): string | undefined {
  if ('title' in taskOrItem) {
    const item = taskOrItem as IContentItem;
    if (currentUserEmployeeId && item.assignedToEmployeeId?.toString() === currentUserEmployeeId) {
      return 'You';
    }
    return formatContentAssigneeLabel(item, employees);
  }

  const task = taskOrItem as IProjectTask;
  const ids = getTaskAssigneeEmployeeIds(task);
  if (ids.length > 0) {
    const parts = ids
      .map((id) => {
        const name = resolveEmployeeName(employees, id, undefined);
        if (!name) return undefined;
        return agendaDisplayName(name, id, currentUserEmployeeId, currentUserEmployeeName);
      })
      .filter((part): part is string => Boolean(part));
    if (parts.length > 0) return parts.join(', ');
  }

  const legacyName = task.assignedTo;
  if (legacyName) {
    return agendaDisplayName(legacyName, undefined, currentUserEmployeeId, currentUserEmployeeName);
  }

  return resolveEmployeeName(
    employees,
    (task as { assignedToEmployeeId?: { toString(): string } }).assignedToEmployeeId?.toString(),
    undefined
  );
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
