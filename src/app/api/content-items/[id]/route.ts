import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ContentItem from '@/lib/models/ContentItem';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { isValidObjectId } from '@/lib/utils/security';
import { Types } from 'mongoose';

const CHANNELS = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Article', 'Video', 'Reddit', 'Bluesky', 'Other'] as const;
const STATUSES = ['idea', 'planned', 'in_progress', 'ready', 'published'] as const;

async function getContentItemWithAccess(id: string, session: { userId: string }) {
  if (!isValidObjectId(id)) return { item: null, error: { status: 400, message: 'Invalid ID' } };

  const user = await User.findById(session.userId);
  if (!user || !user.organizationId) return { item: null, error: { status: 404, message: 'User or organization not found' } };

  const Employee = (await import('@/lib/models/Employee')).default;
  const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
  const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
  const userRole = currentUserEmployee?.role || 'User';

  const item = await ContentItem.findById(id).lean();
  if (!item) return { item: null, error: { status: 404, message: 'Content item not found' } };

  const project = await Project.findById((item as any).projectId).lean();
  if (!project) return { item: null, error: { status: 404, message: 'Project not found' } };

  const projectInOrg = orgUserIds.some((uid) => uid.toString() === (project as any).userId?.toString());
  if (!projectInOrg) return { item: null, error: { status: 404, message: 'Content item not found' } };

  if (userRole !== 'Administrator' && userRole !== 'Manager') {
    const assignedId = (item as any).assignedToEmployeeId?.toString();
    const myId = currentUserEmployee?._id?.toString();
    if (!myId || assignedId !== myId) return { item: null, error: { status: 404, message: 'Content item not found' } };
  }

  return { item, userRole, currentUserEmployee };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const { item, error } = await getContentItemWithAccess(id, session as any);
    if (error) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(item);
  } catch (e) {
    console.error('GET content-items/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const { item, error } = await getContentItemWithAccess(id, session as any);
    if (error) return NextResponse.json({ error: error.message }, { status: error.status });

    const doc = await ContentItem.findById(id);
    if (!doc) return NextResponse.json({ error: 'Content item not found' }, { status: 404 });

    const body = await request.json();
    const { title, channel, status, publishDate, notes, assignedToEmployeeId, keywords, internalLinks, externalUrl } = body;

    if (title !== undefined) doc.title = String(title).trim();
    if (channel !== undefined && CHANNELS.includes(channel)) doc.channel = channel;
    if (status !== undefined && STATUSES.includes(status)) doc.status = status;
    if (notes !== undefined) doc.notes = notes === '' ? undefined : String(notes).trim();
    if (publishDate !== undefined) doc.publishDate = publishDate === null || publishDate === '' ? undefined : new Date(publishDate);
    if (keywords !== undefined) doc.keywords = Array.isArray(keywords) ? keywords.map(String) : [];
    if (internalLinks !== undefined) doc.internalLinks = Array.isArray(internalLinks) ? internalLinks.map(String) : [];
    if (externalUrl !== undefined) doc.externalUrl = externalUrl === '' ? undefined : String(externalUrl).trim();

    if (assignedToEmployeeId !== undefined) {
      if (assignedToEmployeeId === null || assignedToEmployeeId === '') {
        doc.assignedToEmployeeId = undefined;
      } else if (isValidObjectId(assignedToEmployeeId)) {
        doc.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
      }
    }

    await doc.save();
    const updated = await ContentItem.findById(id).lean();
    return NextResponse.json(updated);
  } catch (e) {
    console.error('PATCH content-items/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const { item, error } = await getContentItemWithAccess(id, session as any);
    if (error) return NextResponse.json({ error: error.message }, { status: error.status });

    await ContentItem.findByIdAndDelete(id);
    return NextResponse.json({ message: 'Content item deleted successfully' });
  } catch (e) {
    console.error('DELETE content-items/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
