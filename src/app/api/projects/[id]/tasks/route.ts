import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateProjectFields } from '@/lib/utils/apiHelpers';
import { parseDateSafe, getDefaultTaskDates } from '@/lib/utils/dateUtils';
import { Types } from 'mongoose';
import {
  canUserContributeToProject,
  findTaskAssigneeOffProjectTeam,
  sanitizeTaskAssigneesForProjectTeam,
} from '@/lib/utils/projectTeam';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';

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

async function buildTaskDocument(task: IncomingTask, organizationId: string) {
  const defaultDates = getDefaultTaskDates();
  let startDate = parseDateSafe(task.startDate) || defaultDates.startDate;
  let endDate = parseDateSafe(task.endDate) || defaultDates.endDate;

  if (startDate) {
    startDate = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
    );
  }
  if (endDate) {
    endDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  }

  let taskStatus: 'active' | 'completed' | 'in-review' = 'active';
  if (task.status !== undefined && task.status !== null) {
    const statusStr = String(task.status).toLowerCase().trim();
    if (statusStr === 'completed' || statusStr === 'complete') taskStatus = 'completed';
    else if (statusStr === 'in-review' || statusStr === 'in_review') taskStatus = 'in-review';
    else if (statusStr === 'active') taskStatus = 'active';
  }

  const taskData: Record<string, unknown> = {
    name: task.name || 'Untitled Task',
    description: task.description || undefined,
    startDate,
    endDate,
    estimatedHours:
      task.estimatedHours !== undefined && task.estimatedHours !== null ? task.estimatedHours : undefined,
    status: taskStatus,
  };

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
    const isManagerOrAdmin =
      currentUserEmployee?.role === 'Manager' || currentUserEmployee?.role === 'Administrator';
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

    const built = await Promise.all(
      incoming.map((task) => buildTaskDocument(task, user.organizationId!))
    );

    const existingTasks = [...(project.tasks ?? [])];
    const merged = [...existingTasks, ...built];
    const { tasks: sanitizedTasks } = sanitizeTaskAssigneesForProjectTeam(
      project,
      merged as IncomingTask[]
    );

    const assigneeIssue = findTaskAssigneeOffProjectTeam(project, sanitizedTasks);
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
