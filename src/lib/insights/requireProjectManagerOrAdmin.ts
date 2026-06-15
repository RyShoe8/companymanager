import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';

export async function requireProjectManagerOrAdmin(
  request: NextRequest,
  projectId: string
): Promise<
  | { error: NextResponse; project: null; employee: null }
  | { error: null; project: Awaited<ReturnType<typeof Project.findOne>>; employee: Awaited<ReturnType<typeof Employee.findOne>> }
> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) {
    return { error: session, project: null, employee: null };
  }

  await connectDB();

  const user = await User.findById(session.userId);
  if (!user?.organizationId) {
    return {
      error: NextResponse.json({ error: 'User or organization not found' }, { status: 404 }),
      project: null,
      employee: null,
    };
  }

  const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
  const isManagerOrAdmin =
    employee && (employee.role === 'Manager' || employee.role === 'Administrator');

  if (!isManagerOrAdmin) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 }),
      project: null,
      employee: null,
    };
  }

  const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
  if (!Types.ObjectId.isValid(projectId)) {
    return {
      error: NextResponse.json({ error: 'Invalid project id' }, { status: 400 }),
      project: null,
      employee: null,
    };
  }

  const project = await Project.findOne({ _id: projectId, userId: { $in: orgUserIds } });
  if (!project) {
    return {
      error: NextResponse.json({ error: 'Project not found' }, { status: 404 }),
      project: null,
      employee: null,
    };
  }

  return { error: null, project, employee };
}
