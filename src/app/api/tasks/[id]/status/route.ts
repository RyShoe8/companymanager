import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project, { TaskStatus } from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';

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

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const user = await User.findById(session.userId);
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

    (project.tasks as { status: TaskStatus }[])[index].status = status;
    await project.save();

    return NextResponse.json({ success: true, task: project.tasks?.[index], status });
  } catch (error) {
    console.error('PATCH /api/tasks/[id]/status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
