import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { getTaskByProject, isEmployeeAssignedToTask, toTaskIndex } from '@/lib/projects/taskLookup';
import {
  canContributorUpdateTaskFields,
  hasRestrictedTaskFieldUpdates,
  parseContributorTaskFieldUpdates,
  type TaskFieldUpdateBody,
} from '@/lib/projects/taskFieldUpdateAuth';
import { canDeleteTask } from '@/lib/projects/taskDeleteAuth';
import { cleanupRemovedTasks, findRemovedTasks } from '@/lib/cleanup/entityCleanup';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { id } = await params;
    const body = (await request.json()) as {
      projectId?: string;
      taskId?: string;
      taskIndex?: number;
    };
    const { projectId, taskId, taskIndex: bodyTaskIndex } = body;
    const taskIndex = toTaskIndex(id, bodyTaskIndex);

    if (!projectId || (!taskId && taskIndex === undefined)) {
      return NextResponse.json(
        { error: 'projectId and (taskId or taskIndex) are required' },
        { status: 400 }
      );
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
      organizationId: user.organizationId,
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 403 });
    }

    const isManagerOrAdmin = employee.role === 'Manager' || employee.role === 'Administrator';
    const employeeId = employee._id.toString();
    const resolved = getTaskByProject(project, taskId, taskIndex);
    if (!resolved) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, index } = resolved;
    if (
      !canDeleteTask({
        task: task as { createdByEmployeeId?: { toString(): string } },
        isManagerOrAdmin,
        currentUserEmployeeId: employeeId,
      })
    ) {
      return NextResponse.json({ error: 'You cannot delete this task' }, { status: 403 });
    }

    const previousTasks = [...(project.tasks ?? [])];
    const removedTaskId = (previousTasks[index] as { _id?: { toString(): string } })?._id?.toString();
    const nextTasks = previousTasks.filter((_, idx) => idx !== index);
    project.tasks = nextTasks as typeof project.tasks;
    project.markModified('tasks');
    await project.save();

    const removed = findRemovedTasks(previousTasks, nextTasks);
    if (removed.length === 0 && removedTaskId) {
      await cleanupRemovedTasks(projectId, [{ taskId: removedTaskId, taskIndex: index }]);
    } else if (removed.length > 0) {
      await cleanupRemovedTasks(projectId, removed);
    }

    await touchProjectActivity(projectId);

    const refreshed = await Project.findById(projectId).select('updatedAt').lean();
    const projectUpdatedAt = (refreshed as { updatedAt?: Date } | null)?.updatedAt;

    return NextResponse.json({
      success: true,
      tasks: project.tasks,
      projectUpdatedAt: projectUpdatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
    const body = (await request.json()) as TaskFieldUpdateBody & {
      projectId?: string;
      taskId?: string;
      taskIndex?: number;
    };
    const { projectId, taskId, taskIndex: bodyTaskIndex } = body;
    const taskIndex = toTaskIndex(id, bodyTaskIndex);

    if (!projectId || (!taskId && taskIndex === undefined)) {
      return NextResponse.json(
        { error: 'projectId and (taskId or taskIndex) are required' },
        { status: 400 }
      );
    }

    const { updates, error: parseError } = parseContributorTaskFieldUpdates(body);
    if (parseError) {
      return NextResponse.json({ error: parseError }, { status: 400 });
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
      organizationId: user.organizationId,
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 403 });
    }

    const isManagerOrAdmin = employee.role === 'Manager' || employee.role === 'Administrator';
    const employeeId = employee._id.toString();
    const resolved = getTaskByProject(project, taskId, taskIndex);
    if (!resolved) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, index } = resolved;
    const isAssigned = isEmployeeAssignedToTask(task, employeeId, employee.name);

    if (
      !canContributorUpdateTaskFields({
        isManagerOrAdmin,
        isAssigned,
        task: task as { createdByEmployeeId?: { toString(): string } | string | null },
        currentUserEmployeeId: employeeId,
      })
    ) {
      return NextResponse.json({ error: 'You cannot update this task' }, { status: 403 });
    }

    if (!isManagerOrAdmin && hasRestrictedTaskFieldUpdates(body)) {
      return NextResponse.json(
        { error: 'You can only update task name, description, and estimated hours' },
        { status: 403 }
      );
    }

    const taskDoc = project.tasks?.[index] as {
      name?: string;
      description?: string;
      estimatedHours?: number;
    };
    if (!taskDoc) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (typeof updates.name === 'string') taskDoc.name = updates.name;
    if (typeof updates.description === 'string') {
      taskDoc.description = updates.description || undefined;
    }
    if (typeof updates.estimatedHours === 'number') {
      taskDoc.estimatedHours = updates.estimatedHours;
    }

    project.markModified('tasks');
    await project.save();
    await touchProjectActivity(projectId);

    const refreshed = await Project.findById(projectId).select('updatedAt').lean();
    const projectUpdatedAt = (refreshed as { updatedAt?: Date } | null)?.updatedAt;

    void import('@/lib/workspace/workspaceNotifications').then(({ notifyTaskChange }) => {
      void notifyTaskChange({
        project,
        task: project.tasks?.[index] as Parameters<typeof notifyTaskChange>[0]['task'],
        taskIndex: index,
        actorUserId: session.userId,
        actorEmployeeId: employeeId,
        organizationId: user.organizationId!,
        isNew: false,
        changeLabel: 'Task updated',
      }).catch((err) => console.error('[workspaceNotifications] task_field', err));
    });

    return NextResponse.json({
      success: true,
      task: project.tasks?.[index],
      projectUpdatedAt: projectUpdatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
