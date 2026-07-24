import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateProjectFields } from '@/lib/utils/apiHelpers';
import { isManagerOrAdminRole } from '@/lib/utils/roles';
import { parseDateSafe, getDefaultTaskDates, resolveTaskDateInput } from '@/lib/utils/dateUtils';
import { Types } from 'mongoose';
import {
  canUserContributeToProject,
  findTaskAssigneeOffProjectTeam,
  mergeProjectTeamWithClient,
  sanitizeTaskAssigneesForProjectTeam,
  type ProjectTeamSource,
} from '@/lib/utils/projectTeam';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { validateIncomingTaskArray } from '@/lib/projects/taskArrayGuards';
import { resolveTaskCompletedAt } from '@/lib/cleanup/statusTimestamps';
import {
  allowBulkTaskExpandForRequest,
  parseIncomingTaskStatus,
  shouldForceActiveTaskStatus,
} from '@/lib/projects/taskCreateAuth';

type IncomingTask = {
  name?: string;
  description?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  estimatedHours?: number;
  status?: string;
  assignedTo?: string;
  assignedToEmployeeId?: string;
  assignedToEmployeeIds?: string[];
};

function taskHasExplicitAssignee(task: IncomingTask): boolean {
  return (
    task.assignedToEmployeeId != null ||
    task.assignedToEmployeeIds !== undefined ||
    (task.assignedTo != null && task.assignedTo !== '')
  );
}

function applyCreatorAssigneeDefault(
  task: IncomingTask,
  creatorEmployeeId: string | null | undefined,
  isManagerOrAdmin: boolean
): IncomingTask {
  if (isManagerOrAdmin || !creatorEmployeeId || taskHasExplicitAssignee(task)) {
    return task;
  }
  return {
    ...task,
    assignedToEmployeeIds: [creatorEmployeeId],
  };
}

async function buildTaskDocument(
  task: IncomingTask,
  organizationId: string,
  createdByEmployeeId?: string | null,
  options?: { forceActiveStatus?: boolean }
) {
  const defaultDates = getDefaultTaskDates();
  const startDate = resolveTaskDateInput(task.startDate, { fallback: defaultDates.startDate });
  const endDate = resolveTaskDateInput(task.endDate, { fallback: defaultDates.endDate });

  const taskStatus = options?.forceActiveStatus ? 'active' : parseIncomingTaskStatus(task.status);

  const taskData: Record<string, unknown> = {
    name: typeof task.name === 'string' ? task.name.trim() : '',
    description: task.description || undefined,
    startDate,
    endDate,
    estimatedHours:
      task.estimatedHours !== undefined && task.estimatedHours !== null ? task.estimatedHours : undefined,
    status: taskStatus,
    completedAt: resolveTaskCompletedAt(undefined, taskStatus),
  };

  if (createdByEmployeeId) {
    taskData.createdByEmployeeId = new Types.ObjectId(createdByEmployeeId);
  }

  if (task.assignedToEmployeeIds !== undefined) {
    if (!Array.isArray(task.assignedToEmployeeIds) || task.assignedToEmployeeIds.length === 0) {
      taskData.assignedToEmployeeIds = [];
      taskData.assignedToEmployeeId = undefined;
      taskData.assignedTo = undefined;
    } else {
      taskData.assignedToEmployeeIds = task.assignedToEmployeeIds.map((id) => new Types.ObjectId(id));
      const assignedEmployees = await Employee.find({ _id: { $in: taskData.assignedToEmployeeIds as Types.ObjectId[] } });
      taskData.assignedTo = assignedEmployees.map((e) => e.name).join(', ');
      taskData.assignedToEmployeeId = (taskData.assignedToEmployeeIds as Types.ObjectId[])[0];
    }
  } else if (task.assignedToEmployeeId) {
    taskData.assignedToEmployeeId = new Types.ObjectId(task.assignedToEmployeeId);
    taskData.assignedToEmployeeIds = [taskData.assignedToEmployeeId];
    const assignedEmployee = await Employee.findById(task.assignedToEmployeeId);
    if (assignedEmployee) taskData.assignedTo = assignedEmployee.name;
  } else if (task.assignedTo) {
    const assignedEmployee = await Employee.findOne({
      name: task.assignedTo,
      organizationId,
    });
    if (assignedEmployee) {
      taskData.assignedToEmployeeId = assignedEmployee._id;
      taskData.assignedToEmployeeIds = [assignedEmployee._id];
    }
    taskData.assignedTo = task.assignedTo;
  } else {
    taskData.assignedToEmployeeId = undefined;
    taskData.assignedToEmployeeIds = [];
    taskData.assignedTo = undefined;
  }

  return taskData;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: user.organizationId,
    });
    const isManagerOrAdmin = isManagerOrAdminRole(currentUserEmployee?.role);
    const employeeId = currentUserEmployee?._id?.toString() ?? null;

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    migrateProjectFields(project);

    if (!canUserContributeToProject(project, employeeId, Boolean(isManagerOrAdmin))) {
      return NextResponse.json(
        { error: 'You can only add tasks to projects you are assigned to' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const incoming: IncomingTask[] = Array.isArray(body.tasks)
      ? body.tasks
      : body.task
        ? [body.task as IncomingTask]
        : [];

    if (incoming.length === 0) {
      return NextResponse.json({ error: 'At least one task is required' }, { status: 400 });
    }

    const appendGuardError = validateIncomingTaskArray({
      previousCount: (project.tasks ?? []).length,
      incomingTasks: incoming,
      allowBulkTaskExpand: allowBulkTaskExpandForRequest(
        Boolean(isManagerOrAdmin),
        body.allowBulkTaskExpand
      ),
      isAppend: true,
    });
    if (appendGuardError) {
      console.warn('[projects POST tasks] append guard rejected', {
        projectId: id,
        incomingCount: incoming.length,
        userId: session.userId,
        error: appendGuardError,
      });
      return NextResponse.json({ error: appendGuardError }, { status: 400 });
    }

    const forceActiveStatus = shouldForceActiveTaskStatus(Boolean(isManagerOrAdmin));
    const built = await Promise.all(
      incoming
        .map((task) => applyCreatorAssigneeDefault(task, employeeId, Boolean(isManagerOrAdmin)))
        .map((task) =>
          buildTaskDocument(task, user.organizationId!, employeeId, { forceActiveStatus })
        )
    );

    const existingTasks = [...(project.tasks ?? [])];
    const merged = [...existingTasks, ...built];
    let taskAssigneeTeam: ProjectTeamSource = project;
    if (project.clientId) {
      const Client = (await import('@/lib/models/Client')).default;
      const client = await Client.findById(project.clientId);
      taskAssigneeTeam = mergeProjectTeamWithClient(project, client);
    }
    const { tasks: sanitizedTasks } = sanitizeTaskAssigneesForProjectTeam(
      taskAssigneeTeam,
      merged as IncomingTask[]
    );

    const assigneeIssue = findTaskAssigneeOffProjectTeam(taskAssigneeTeam, sanitizedTasks);
    if (assigneeIssue) {
      return NextResponse.json(
        {
          error: assigneeIssue.message,
          taskIndex: assigneeIssue.taskIndex,
          taskName: assigneeIssue.taskName,
          assigneeId: assigneeIssue.assigneeId,
        },
        { status: 400 }
      );
    }

    project.tasks = sanitizedTasks as typeof project.tasks;
    project.markModified('tasks');
    await project.save();
    await touchProjectActivity(id);

    const addedFromIndex = existingTasks.length;

    void import('@/lib/workspace/workspaceNotifications').then(({ notifyTaskChange }) => {
      const organizationId = user.organizationId!;
      const actorUserId = session.userId;
      const actorEmployeeId = employeeId;
      const addedTasks = (project.tasks ?? []).slice(addedFromIndex);

      for (const [offset, task] of addedTasks.entries()) {
        void notifyTaskChange({
          project,
          task,
          taskIndex: addedFromIndex + offset,
          actorUserId,
          actorEmployeeId,
          organizationId,
          isNew: true,
          changeLabel: 'New task assigned',
        }).catch((err) => console.error('[workspaceNotifications] task_new', err));
      }
    });
    return NextResponse.json({
      tasks: project.tasks,
      addedFromIndex,
      addedCount: built.length,
    });
  } catch (error) {
    console.error('Error adding project tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
