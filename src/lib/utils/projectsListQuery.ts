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
  /** Client IDs whose hub projects the user may access via client team membership. */
  clientIdsForHubAccess?: Types.ObjectId[];
}): Record<string, unknown> {
  const { orgUserIds, status, userRole, currentUserEmployee, clientIdsForHubAccess } = options;
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

  const orConditions: Record<string, unknown>[] = [
    { assignedToEmployeeId: employeeId },
    { assignedToEmployeeIds: employeeId },
    { 'tasks.assignedToEmployeeId': employeeId },
    { 'tasks.assignedToEmployeeIds': employeeId },
    { assignedTo: currentUserEmployee.name },
    { assignedToNames: currentUserEmployee.name },
    { 'tasks.assignedTo': currentUserEmployee.name },
    { 'stages.assignedTo': currentUserEmployee.name },
  ];

  if (clientIdsForHubAccess && clientIdsForHubAccess.length > 0) {
    orConditions.push({
      $and: [
        { projectType: 'client-admin' },
        { clientId: { $in: clientIdsForHubAccess } },
      ],
    });
  }

  return {
    $and: [
      { userId: { $in: orgUserIds } },
      ...(status ? [{ status }] : []),
      {
        $or: orConditions,
      },
    ],
  };
}
