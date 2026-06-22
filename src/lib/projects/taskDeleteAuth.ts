type TaskWithCreator = {
  createdByEmployeeId?: { toString(): string } | string | null;
};

export function getTaskCreatorEmployeeId(task: TaskWithCreator): string | null {
  const creator = task.createdByEmployeeId;
  if (!creator) return null;
  return typeof creator === 'string' ? creator : creator.toString();
}

export function canDeleteTask(params: {
  task: TaskWithCreator;
  isManagerOrAdmin: boolean;
  currentUserEmployeeId: string | null | undefined;
}): boolean {
  if (params.isManagerOrAdmin) return true;
  if (!params.currentUserEmployeeId) return false;
  const creatorId = getTaskCreatorEmployeeId(params.task);
  if (!creatorId) return false;
  return creatorId === params.currentUserEmployeeId;
}
