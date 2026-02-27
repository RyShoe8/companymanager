import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { isValidObjectId } from '@/lib/utils/security';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;
    await connectDB();
    const { id } = await params;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const actionButtons = (project as { actionButtons?: { label: string; url: string; referralSourceId?: unknown }[] }).actionButtons || [];
    return NextResponse.json({ actionButtons });
  } catch (error) {
    console.error('Error fetching project buttons:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }
    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const body = await request.json();
    const { label, url, referralSourceId } = body;
    if (!label || !url) {
      return NextResponse.json({ error: 'label and url are required' }, { status: 400 });
    }
    const actionButtons = Array.isArray(project.actionButtons) ? [...project.actionButtons] : [];
    if (actionButtons.some((b: { url: string }) => b.url === url)) {
      return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
    }
    actionButtons.push({
      label: String(label).trim(),
      url: String(url).trim(),
      ...(referralSourceId && isValidObjectId(referralSourceId) ? { referralSourceId } : {}),
    });
    project.actionButtons = actionButtons;
    await project.save();
    return NextResponse.json(project.actionButtons, { status: 201 });
  } catch (error) {
    console.error('Error adding project button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
