import type { IEmployee } from '@/lib/models/Employee';

export type ProjectTeamSource = {
  assignedToEmployeeIds?: unknown[];
  assignedToEmployeeId?: unknown;
};

function normalizeEmployeeId(id: unknown): string | null {
  if (id == null || id === '') return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id !== null && 'toString' in id) {
    return (id as { toString(): string }).toString();
  }
  return String(id);
}

/** Employee IDs on the project team (assignedToEmployeeIds + legacy single field). */
export function getProjectTeamEmployeeIds(project: ProjectTeamSource): Set<string> {
  const ids = new Set<string>();
  const fromArray = project.assignedToEmployeeIds ?? [];
  for (const id of fromArray) {
    const normalized = normalizeEmployeeId(id);
    if (normalized) ids.add(normalized);
  }
  if (ids.size === 0) {
    const legacy = normalizeEmployeeId(project.assignedToEmployeeId);
    if (legacy) ids.add(legacy);
  }
  return ids;
}

export function isEmployeeOnProjectTeam(
  project: ProjectTeamSource,
  employeeId: string | unknown
): boolean {
  const normalized = normalizeEmployeeId(employeeId);
  if (!normalized) return false;
  return getProjectTeamEmployeeIds(project).has(normalized);
}

export function filterEmployeesForTaskAssignment(
  employees: IEmployee[],
  project: ProjectTeamSource,
  options?: { includeEmployeeIds?: Iterable<string | unknown> }
): IEmployee[] {
  const teamIds = getProjectTeamEmployeeIds(project);
  const allowed = new Set(teamIds);
  if (options?.includeEmployeeIds) {
    for (const id of options.includeEmployeeIds) {
      const normalized = normalizeEmployeeId(id);
      if (normalized) allowed.add(normalized);
    }
  }
  return employees.filter((emp) => allowed.has(emp._id.toString()));
}

export function taskAssigneeSelectOptions(
  employees: IEmployee[],
  project: ProjectTeamSource,
  currentAssigneeId?: unknown
): { value: string; label: string }[] {
  const includeIds = currentAssigneeId ? [currentAssigneeId] : [];
  return filterEmployeesForTaskAssignment(employees, project, { includeEmployeeIds: includeIds }).map(
    (emp) => ({ value: emp._id.toString(), label: emp.name })
  );
}

/** Returns an error message if any task assignee is not on the project team. */
export function validateTaskAssigneesOnProjectTeam(
  project: ProjectTeamSource,
  tasks: { assignedToEmployeeId?: unknown }[]
): string | null {
  const teamIds = getProjectTeamEmployeeIds(project);
  for (const task of tasks) {
    const assigneeId = normalizeEmployeeId(task.assignedToEmployeeId);
    if (assigneeId && !teamIds.has(assigneeId)) {
      return 'Assignee must be on the project team';
    }
  }
  return null;
}
