export type TaskLike = {
  _id?: { toString: () => string };
  assignedTo?: string;
  assignedToEmployeeId?: { toString: () => string };
  assignedToEmployeeIds?: Array<{ toString: () => string }>;
};

export function getTaskByProject(
  project: { tasks?: unknown[] },
  taskId?: string,
  taskIndex?: number
): { task: TaskLike; index: number } | null {
  if (!project.tasks || !project.tasks.length) return null;
  if (taskId) {
    const index = (project.tasks as { _id?: { toString: () => string } }[]).findIndex(
      (t) => t._id?.toString() === taskId
    );
    if (index === -1 || !project.tasks[index]) return null;
    return { task: project.tasks[index] as TaskLike, index };
  }
  if (taskIndex !== undefined && project.tasks[taskIndex]) {
    return { task: project.tasks[taskIndex] as TaskLike, index: taskIndex };
  }
  return null;
}

export function toTaskIndex(idParam: string, bodyTaskIndex: unknown): number | undefined {
  if (typeof bodyTaskIndex === 'number' && Number.isInteger(bodyTaskIndex) && bodyTaskIndex >= 0) {
    return bodyTaskIndex;
  }
  const parsed = Number(idParam);
  if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  return undefined;
}

export function isEmployeeAssignedToTask(
  task: TaskLike,
  employeeId: string,
  employeeName: string
): boolean {
  const taskAssigneeIds = (task.assignedToEmployeeIds ?? []).map((assigneeId) =>
    assigneeId?.toString()
  );
  return (
    task.assignedToEmployeeId?.toString() === employeeId ||
    taskAssigneeIds.includes(employeeId) ||
    task.assignedTo === employeeName
  );
}
