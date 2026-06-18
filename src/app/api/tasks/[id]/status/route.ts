import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project, { TaskStatus } from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { cleanupCompletedTaskMedia } from '@/lib/recordings/recordingCleanup';
import { normalizeTaskStatus } from '@/lib/projects/projectCleanup';
import { resolveTaskCompletedAt } from '@/lib/cleanup/statusTimestamps';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';

type TaskLike = {
  status?: TaskStatus;
  assignedTo?: string;
  assignedToEmployeeId?: { toString: () => string };
  assignedToEmployeeIds?: Array<{ toString: () => string }>;
};

const ALLOWED_TASK_STATUSES: TaskStatus[] = ['active', 'in-review', 'completed'];

function getTaskByProject(
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

function toTaskIndex(idParam: string, bodyTaskIndex: unknown): number | undefined {
  if (typeof bodyTaskIndex === 'number' && Number.isInteger(bodyTaskIndex) && bodyTaskIndex >= 0) {
    return bodyTaskIndex;
  }
  const parsed = Number(idParam);
  if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  return undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const { projectId, taskId, taskIndex: bodyTaskIndex, status } = body;
    const taskIndex = toTaskIndex(id, bodyTaskIndex);

    if (!projectId || (!taskId && taskIndex === undefined) || !status) {
      return NextResponse.json(
        { error: 'projectId, status, and (taskId or taskIndex) are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TASK_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid task status' }, { status: 400 });
    }

    const user = await User.findById(session.userId);
    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: projectId, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const employee = await Employee.findOne({
      userId: session.userId,
      organizationId: user?.organizationId,
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 403 });
    }

    const isManagerOrAdmin = employee.role === 'Manager' || employee.role === 'Administrator';
    const resolved = getTaskByProject(project, taskId, taskIndex);
    if (!resolved) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, index } = resolved;
    const employeeId = employee._id.toString();
    const taskAssigneeIds = (task.assignedToEmployeeIds ?? []).map((assigneeId) =>
      assigneeId?.toString()
    );
    const isAssigned =
      task.assignedToEmployeeId?.toString() === employeeId ||
      taskAssigneeIds.includes(employeeId) ||
      task.assignedTo === employee.name;

    if (!isManagerOrAdmin && !isAssigned) {
      return NextResponse.json(
        { error: 'You can only update status for tasks assigned to you' },
        { status: 403 }
      );
    }

    const previousStatus = normalizeTaskStatus(task.status);
    const taskObjectId = (project.tasks as { _id?: { toString: () => string } }[])[index]?._id?.toString();
    const taskDoc = (project.tasks as Array<{ status: TaskStatus; completedAt?: Date }>)[index];

    taskDoc.status = status;
    taskDoc.completedAt = resolveTaskCompletedAt(
      previousStatus,
      status,
      taskDoc.completedAt
    );
    await project.save();
    await touchProjectActivity(projectId);

    if (previousStatus !== 'completed' && status === 'completed') {
      await cleanupCompletedTaskMedia({
        taskId: taskObjectId,
        taskIndex: index,
        projectId,
      });
    }

    void import('@/lib/workspace/workspaceNotifications').then(({ notifyTaskChange }) => {
      if (!user?.organizationId) return;
      void notifyTaskChange({
        project,
        task: project.tasks?.[index] as Parameters<typeof notifyTaskChange>[0]['task'],
        taskIndex: index,
        actorUserId: session.userId,
        actorEmployeeId: employee._id.toString(),
        organizationId: user.organizationId,
        isNew: false,
        changeLabel: 'Task status updated',
      }).catch((err) => console.error('[workspaceNotifications] task_status', err));
    });

    return NextResponse.json({ success: true, task: project.tasks?.[index], status });
  } catch (error) {
    console.error('PATCH /api/tasks/[id]/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
