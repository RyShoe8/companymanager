import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateProjectFields } from '@/lib/utils/apiHelpers';
import { dedupeProjectTasks } from '@/lib/projects/taskArrayGuards';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';

/** Remove duplicate tasks (same normalized signature) from a project. Managers/admins only. */
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
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Only managers can dedupe project tasks' }, { status: 403 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    migrateProjectFields(project);

    const before = [...(project.tasks ?? [])];
    const deduped = dedupeProjectTasks(before as unknown as Record<string, unknown>[]);
    const removedCount = before.length - deduped.length;

    if (removedCount === 0) {
      return NextResponse.json({
        tasks: project.tasks,
        beforeCount: before.length,
        afterCount: before.length,
        removedCount: 0,
      });
    }

    project.tasks = deduped as unknown as typeof project.tasks;
    project.markModified('tasks');
    await project.save();
    await touchProjectActivity(id);

    console.info('[tasks dedupe] removed duplicate tasks', {
      projectId: id,
      beforeCount: before.length,
      afterCount: deduped.length,
      removedCount,
      userId: session.userId,
    });

    return NextResponse.json({
      tasks: project.tasks,
      beforeCount: before.length,
      afterCount: deduped.length,
      removedCount,
    });
  } catch (error) {
    console.error('Error deduping project tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
