import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { cleanupCompletedTaskMedia } from '@/lib/recordings/recordingCleanup';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { notifyTaskChange } from '@/lib/workspace/workspaceNotifications';

type TaskLike = {
  status: string;
  assignedTo?: string;
  assignedToEmployeeId?: { toString: () => string };
  assignedToEmployeeIds?: Array<{ toString: () => string }>;
};

/** Resolve task by stable taskId or legacy taskIndex. Returns { task, index } or null. */
function getTaskByProject(project: { tasks?: unknown[] }, taskId?: string, taskIndex?: number): { task: TaskLike; index: number } | null {
  if (!project.tasks || !project.tasks.length) return null;
  if (taskId) {
    const index = (project.tasks as { _id?: { toString: () => string } }[]).findIndex((t) => t._id?.toString() === taskId);
    if (index === -1 || !project.tasks[index]) return null;
    return { task: project.tasks[index] as TaskLike, index };
  }
  if (taskIndex !== undefined && project.tasks[taskIndex]) {
    return { task: project.tasks[taskIndex] as TaskLike, index: taskIndex };
  }
  return null;
}

/**
 * POST /api/tasks/[id]/review
 * Submit a task for review. Accepts projectId + taskId (stable) or projectId + taskIndex (legacy).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const body = await request.json();
    const { projectId, taskIndex, taskId } = body;

    if (!projectId || (taskIndex === undefined && !taskId)) {
      return NextResponse.json(
        { error: 'projectId and (taskId or taskIndex) are required' },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const user = await User.findById(session.userId);
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user?.organizationId });

    const resolved = getTaskByProject(project, taskId, taskIndex);
    if (!resolved) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, index } = resolved;
    const employeeId = employee?._id.toString();
    const isAssigned =
      task.assignedToEmployeeId?.toString() === employeeId ||
      (task.assignedToEmployeeIds ?? []).some((id) => id?.toString() === employeeId) ||
      task.assignedTo === employee?.name;

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You can only submit tasks assigned to you for review' },
        { status: 403 }
      );
    }

    (project.tasks as { status: string }[])[index].status = 'in-review';
    await project.save();
    await touchProjectActivity(projectId);

    if (user?.organizationId) {
      void notifyTaskChange({
        project,
        task: project.tasks?.[index] ?? task,
        taskIndex: index,
        actorUserId: session.userId,
        actorEmployeeId: employeeId ?? null,
        organizationId: user.organizationId,
        isNew: false,
        changeLabel: 'Task submitted for review',
      }).catch((err) => console.error('[workspaceNotifications] task_review_submit', err));
    }

    return NextResponse.json({ success: true, task: project.tasks?.[index] ?? task });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/tasks/[id]/review
 * Approve or decline a task review. Accepts projectId + taskId (stable) or projectId + taskIndex (legacy).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const body = await request.json();
    const { projectId, taskIndex, taskId, approved } = body;

    if (!projectId || approved === undefined || (taskIndex === undefined && !taskId)) {
      return NextResponse.json(
        { error: 'projectId, approved, and (taskId or taskIndex) are required' },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const user = await User.findById(session.userId);
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user?.organizationId });

    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json(
        { error: 'Only Managers and Administrators can approve reviews' },
        { status: 403 }
      );
    }

    const isAssignedToProject =
      project.assignedToEmployeeIds?.some((id: unknown) => id && (id as { toString: () => string }).toString() === employee._id.toString()) ||
      project.assignedToEmployeeId?.toString() === employee._id.toString() ||
      project.assignedToNames?.includes(employee.name) ||
      project.assignedTo === employee.name;

    if (!isAssignedToProject) {
      return NextResponse.json(
        { error: 'You must be assigned to the project to approve reviews' },
        { status: 403 }
      );
    }

    const resolved = getTaskByProject(project, taskId, taskIndex);
    if (!resolved) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, index } = resolved;
    (project.tasks as { status: string }[])[index].status = approved ? 'completed' : 'active';
    await project.save();
    await touchProjectActivity(projectId);

    if (approved) {
      const taskObjectId = (project.tasks as { _id?: { toString: () => string } }[])[index]?._id?.toString();
      await cleanupCompletedTaskMedia({
        taskId: taskObjectId,
        taskIndex: index,
        projectId,
      });
    }

    if (user?.organizationId) {
      void notifyTaskChange({
        project,
        task: project.tasks?.[index] ?? task,
        taskIndex: index,
        actorUserId: session.userId,
        actorEmployeeId: employee._id.toString(),
        organizationId: user.organizationId,
        isNew: false,
        changeLabel: approved ? 'Task review approved' : 'Task review declined',
      }).catch((err) => console.error('[workspaceNotifications] task_review_decision', err));
    }

    return NextResponse.json({ success: true, task: project.tasks?.[index] ?? task });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
