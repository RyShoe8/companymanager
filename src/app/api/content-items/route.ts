import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import ContentItem from '@/lib/models/ContentItem';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { isEmployeeOnProjectTeam } from '@/lib/utils/projectTeam';
import { isDistributionMethod } from '@/lib/constants/contentDistribution';
import { Types } from 'mongoose';
import { isValidObjectId } from '@/lib/utils/security';
import { touchProjectActivity } from '@/lib/projects/touchProjectActivity';
import { expandRecurrenceDates } from '@/lib/recurrence/expandRecurrenceDates';
import type { RecurrenceEnd, RecurrencePreset } from '@/lib/scheduling/recurrence';

const CHANNELS = ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Article', 'Video', 'Reddit', 'Bluesky', 'Other'] as const;
const STATUSES = ['idea', 'planned', 'in_progress', 'ready', 'published'] as const;

function isUserAssignedToProject(project: { assignedToEmployeeId?: Types.ObjectId; assignedToEmployeeIds?: Types.ObjectId[]; tasks?: { assignedToEmployeeId?: Types.ObjectId }[] }, employeeId: Types.ObjectId): boolean {
  if (project.assignedToEmployeeId?.toString() === employeeId.toString()) return true;
  if (project.assignedToEmployeeIds?.some((id) => id.toString() === employeeId.toString())) return true;
  if (project.tasks?.some((t) => (t as any).assignedToEmployeeId?.toString() === employeeId.toString())) return true;
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const Employee = (await import('@/lib/models/Employee')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const userRole = currentUserEmployee?.role || 'User';
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const projectIdParam = searchParams.get('projectId');
    const channelParam = searchParams.get('channel');

    const query: Record<string, unknown> = {};

    const orgProjectIds = await Project.find({ userId: { $in: orgUserIds } }).distinct('_id');
    query.projectId = { $in: orgProjectIds };

    if (userRole !== 'Administrator' && userRole !== 'Manager') {
      if (currentUserEmployee) {
        query.assignedToEmployeeId = currentUserEmployee._id;
      } else {
        return NextResponse.json([]);
      }
    }

    if (projectIdParam && isValidObjectId(projectIdParam)) {
      const pid = new Types.ObjectId(projectIdParam);
      if (orgProjectIds.some((id) => id.toString() === pid.toString())) {
        query.projectId = pid;
      }
    }

    if (channelParam && CHANNELS.includes(channelParam as any)) {
      query.channel = channelParam;
    }

    if (startParam && endParam) {
      const start = new Date(startParam);
      const end = new Date(endParam);
      end.setHours(23, 59, 59, 999);
      query.publishDate = { $gte: start, $lte: end };
    }

    const items = await ContentItem.find(query).sort({ publishDate: 1, createdAt: 1 }).lean();
    return NextResponse.json(items);
  } catch (error) {
    console.error('GET content-items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const Employee = (await import('@/lib/models/Employee')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const userRole = currentUserEmployee?.role || 'User';
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const body = await request.json();
    const {
      projectId,
      title,
      channel,
      status,
      publishDate,
      notes,
      assignedToEmployeeId,
      keywords,
      internalLinks,
      externalUrl,
      distributionMethods,
      estimatedHours,
      recurrence,
    } = body;

    if (!projectId || !title || !channel) {
      return NextResponse.json({ error: 'projectId, title, and channel are required' }, { status: 400 });
    }

    if (!isValidObjectId(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }

    const project = await Project.findById(projectId).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectInOrg = orgUserIds.some((id) => id.toString() === (project as any).userId?.toString());
    if (!projectInOrg) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const canCreate =
      userRole === 'Administrator' ||
      userRole === 'Manager' ||
      (currentUserEmployee && isUserAssignedToProject(project as any, currentUserEmployee._id));

    if (!canCreate) {
      return NextResponse.json({ error: 'You can only create content on projects you are assigned to' }, { status: 403 });
    }

    const validChannel = CHANNELS.includes(channel) ? channel : 'Other';
    const validStatus = STATUSES.includes(status) ? status : 'planned';

    const doc: Record<string, unknown> = {
      projectId: new Types.ObjectId(projectId),
      title: String(title).trim(),
      channel: validChannel,
      status: validStatus,
      notes: notes ? String(notes).trim() : undefined,
      userId: session.userId,
    };

    if (publishDate !== undefined && publishDate !== null && publishDate !== '') {
      doc.publishDate = new Date(publishDate);
    }
    if (assignedToEmployeeId && isValidObjectId(assignedToEmployeeId)) {
      if (!isEmployeeOnProjectTeam(project as Parameters<typeof isEmployeeOnProjectTeam>[0], assignedToEmployeeId)) {
        return NextResponse.json({ error: 'Assignee must be on the project team' }, { status: 400 });
      }
      doc.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
    }
    if (keywords !== undefined) {
      doc.keywords = Array.isArray(keywords) ? keywords.map(String) : (typeof keywords === 'string' ? keywords.split(',').map((s) => s.trim()).filter(Boolean) : []);
    }
    if (internalLinks !== undefined) {
      doc.internalLinks = Array.isArray(internalLinks) ? internalLinks.map(String) : (typeof internalLinks === 'string' ? internalLinks.split(',').map((s) => s.trim()).filter(Boolean) : []);
    }
    if (externalUrl !== undefined && externalUrl !== '') {
      doc.externalUrl = String(externalUrl).trim();
    }
    if (distributionMethods !== undefined) {
      doc.distributionMethods = Array.isArray(distributionMethods)
        ? distributionMethods.filter((m: unknown) => typeof m === 'string' && isDistributionMethod(m))
        : [];
    }
    if (estimatedHours !== undefined && estimatedHours !== null && estimatedHours !== '') {
      const parsedHours = Number(estimatedHours);
      if (!isNaN(parsedHours) && parsedHours >= 0) {
        doc.estimatedHours = parsedHours;
      }
    }

    const anchorDate =
      doc.publishDate instanceof Date && !isNaN(doc.publishDate.getTime())
        ? doc.publishDate
        : new Date();

    let publishDates: Date[] = [anchorDate];
    const rec = recurrence as
      | { preset?: RecurrencePreset; end?: RecurrenceEnd; until?: string; count?: number }
      | undefined;
    if (rec?.preset && rec.preset !== 'none') {
      const until =
        rec.end === 'on' && rec.until ? new Date(`${String(rec.until).slice(0, 10)}T23:59:59`) : undefined;
      const count = rec.end === 'after' && rec.count != null ? Number(rec.count) : undefined;
      publishDates = expandRecurrenceDates({
        anchorDate,
        preset: rec.preset,
        end: rec.end ?? 'never',
        until,
        count: Number.isFinite(count) ? count : undefined,
      });
    }

    const created = [];
    for (const pd of publishDates) {
      const row = { ...doc, publishDate: pd };
      created.push(await ContentItem.create(row));
    }

    await touchProjectActivity(projectId);

    if (created.length === 1) {
      return NextResponse.json(created[0], { status: 201 });
    }
    return NextResponse.json({ items: created }, { status: 201 });
  } catch (error) {
    console.error('POST content-items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
