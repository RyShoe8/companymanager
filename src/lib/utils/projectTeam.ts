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
  currentAssigneeIds?: unknown | unknown[]
): { value: string; label: string }[] {
  const includeIds = Array.isArray(currentAssigneeIds)
    ? currentAssigneeIds
    : currentAssigneeIds
      ? [currentAssigneeIds]
      : [];
  return filterEmployeesForTaskAssignment(employees, project, { includeEmployeeIds: includeIds }).map(
    (emp) => ({ value: emp._id.toString(), label: emp.name })
  );
}

/** Returns all assignee employee IDs on a task (array + legacy single field). */
export function getTaskAssigneeEmployeeIds(task: {
  assignedToEmployeeIds?: unknown[];
  assignedToEmployeeId?: unknown;
}): string[] {
  const ids: string[] = [];
  const fromArray = task.assignedToEmployeeIds ?? [];
  for (const id of fromArray) {
    const normalized = normalizeEmployeeId(id);
    if (normalized) ids.push(normalized);
  }
  if (ids.length === 0) {
    const legacy = normalizeEmployeeId(task.assignedToEmployeeId);
    if (legacy) ids.push(legacy);
  }
  return ids;
}

/** True when a task is assigned to the employee (IDs array, legacy ID, or legacy name). */
export function isTaskAssignedToEmployee(
  task: {
    assignedTo?: string;
    assignedToEmployeeIds?: unknown[];
    assignedToEmployeeId?: unknown;
  },
  employee: { _id: { toString(): string } | string; name: string }
): boolean {
  const employeeId =
    typeof employee._id === 'string' ? employee._id : employee._id.toString();
  if (getTaskAssigneeEmployeeIds(task).includes(employeeId)) return true;
  return !!(task.assignedTo && task.assignedTo === employee.name);
}

/** True when a task is assigned to a different employee (not this one). */
export function isTaskAssignedToOtherEmployee(
  task: {
    assignedTo?: string;
    assignedToEmployeeIds?: unknown[];
    assignedToEmployeeId?: unknown;
  },
  employee: { _id: { toString(): string } | string; name: string }
): boolean {
  const employeeId =
    typeof employee._id === 'string' ? employee._id : employee._id.toString();
  const ids = getTaskAssigneeEmployeeIds(task);
  if (ids.length > 0) return !ids.includes(employeeId);
  return !!(task.assignedTo && task.assignedTo !== employee.name);
}

export type TaskAssigneeIssue = {
  message: string;
  taskIndex: number;
  taskName: string;
  assigneeId: string;
};

type TaskAssigneeFields = {
  name?: string;
  assignedTo?: string;
  assignedToEmployeeId?: unknown;
  assignedToEmployeeIds?: unknown[];
};

/** First task with an assignee not on the project team, if any. */
export function findTaskAssigneeOffProjectTeam(
  project: ProjectTeamSource,
  tasks: TaskAssigneeFields[]
): TaskAssigneeIssue | null {
  const message = 'Assignee must be on the project team';
  const teamIds = getProjectTeamEmployeeIds(project);
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    const task = tasks[taskIndex];
    for (const assigneeId of getTaskAssigneeEmployeeIds(task)) {
      if (!teamIds.has(assigneeId)) {
        return {
          message,
          taskIndex,
          taskName: task.name?.trim() || 'Untitled Task',
          assigneeId,
        };
      }
    }
  }
  return null;
}

/** Returns an error message if any task assignee is not on the project team. */
export function validateTaskAssigneesOnProjectTeam(
  project: ProjectTeamSource,
  tasks: TaskAssigneeFields[]
): string | null {
  return findTaskAssigneeOffProjectTeam(project, tasks)?.message ?? null;
}

/** True when every assignee on the task is on the project team (or task is unassigned). */
export function isTaskAssigneeOnProjectTeam(
  project: ProjectTeamSource,
  task: TaskAssigneeFields
): boolean {
  const ids = getTaskAssigneeEmployeeIds(task);
  if (ids.length === 0) return true;
  const teamIds = getProjectTeamEmployeeIds(project);
  return ids.every((id) => teamIds.has(id));
}

/** Drop off-team assignees so PUT can succeed; returns stripped assignees for logging/UI. */
export function sanitizeTaskAssigneesForProjectTeam<T extends TaskAssigneeFields>(
  project: ProjectTeamSource,
  tasks: T[]
): {
  tasks: T[];
  stripped: { taskIndex: number; taskName: string; assigneeId: string }[];
} {
  const teamIds = getProjectTeamEmployeeIds(project);
  const stripped: { taskIndex: number; taskName: string; assigneeId: string }[] = [];

  const sanitized = tasks.map((task, taskIndex) => {
    const ids = getTaskAssigneeEmployeeIds(task);
    const validIds = ids.filter((id) => {
      if (teamIds.has(id)) return true;
      stripped.push({
        taskIndex,
        taskName: task.name?.trim() || 'Untitled Task',
        assigneeId: id,
      });
      return false;
    });

    if (validIds.length === 0) {
      return {
        ...task,
        assignedToEmployeeIds: [],
        assignedToEmployeeId: undefined,
        assignedTo: undefined,
      };
    }

    if (validIds.length === ids.length) {
      return task;
    }

    return {
      ...task,
      assignedToEmployeeIds: validIds,
      assignedToEmployeeId: validIds[0],
      assignedTo: undefined,
    };
  });

  return { tasks: sanitized, stripped };
}
