import { Types } from 'mongoose';

export type ProjectListRole = 'Administrator' | 'Manager' | 'User';

export interface ProjectListEmployee {
  _id: Types.ObjectId;
  name: string;
}

/** Build MongoDB query for GET /api/projects with mandatory org boundary. */
export function buildProjectsListQuery(options: {
  orgUserIds: Types.ObjectId[];
  status?: string | null;
  userRole: ProjectListRole | string;
  currentUserEmployee?: ProjectListEmployee | null;
}): Record<string, unknown> {
  const { orgUserIds, status, userRole, currentUserEmployee } = options;
  const query: Record<string, unknown> = { userId: { $in: orgUserIds } };
  if (status) {
    query.status = status;
  }

  if (userRole === 'Administrator' || userRole === 'Manager') {
    return query;
  }

  if (!currentUserEmployee) {
    return { _id: { $exists: false } };
  }

  const employeeId = currentUserEmployee._id;
  delete query.userId;
  if (status) delete query.status;

  return {
    $and: [
      { userId: { $in: orgUserIds } },
      ...(status ? [{ status }] : []),
      {
        $or: [
          { assignedToEmployeeId: employeeId },
          { assignedToEmployeeIds: employeeId },
          { 'tasks.assignedToEmployeeId': employeeId },
          { 'tasks.assignedToEmployeeIds': employeeId },
          { assignedTo: currentUserEmployee.name },
          { assignedToNames: currentUserEmployee.name },
          { 'tasks.assignedTo': currentUserEmployee.name },
          { 'stages.assignedTo': currentUserEmployee.name },
        ],
      },
    ],
  };
}
