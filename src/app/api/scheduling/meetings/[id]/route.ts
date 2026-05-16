import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting, { IMeeting } from '@/lib/models/Meeting';
import Project from '@/lib/models/Project';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import {
  getOrganizationUserIds,
  migrateProjectFields,
  migrateStagesToTasks,
} from '@/lib/utils/apiHelpers';
import {
  buildMeetingFullDescription,
  pushMeetingDescriptionToGoogle,
} from '@/lib/scheduling/meetingCalendarSync';
import { Types } from 'mongoose';

async function loadOrgProjects(
  userId: string,
  organizationId: string,
  projectIds: Types.ObjectId[]
) {
  const orgUserIds = await getOrganizationUserIds(userId, organizationId);
  const projects = await Project.find({
    _id: { $in: projectIds },
    userId: { $in: orgUserIds },
  }).lean();
  return projects.map((p) => migrateProjectFields(migrateStagesToTasks(p))) as any[];
}

async function syncMeetingAgendaToCalendar(
  userId: Types.ObjectId,
  meeting: IMeeting,
  projects: any[],
  baseUrl: string
) {
  const fullDescription = buildMeetingFullDescription(meeting, projects, baseUrl);
  await pushMeetingDescriptionToGoogle(userId, meeting, fullDescription);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();

    await connectDB();
    const meeting = await Meeting.findOne({ _id: id, userId: ctx.userId });
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (body.title !== undefined) meeting.title = String(body.title).trim();
    if (body.start !== undefined) meeting.start = new Date(body.start);
    if (body.end !== undefined) meeting.end = new Date(body.end);
    if (body.description !== undefined) meeting.description = body.description;

    const linkedProjectsChanged =
      body.linkedProjectIds !== undefined && Array.isArray(body.linkedProjectIds);

    if (linkedProjectsChanged) {
      meeting.linkedProjectIds = body.linkedProjectIds
        .filter((pid: string) => Types.ObjectId.isValid(pid))
        .map((pid: string) => new Types.ObjectId(pid));
    }

    const baseUrl = new URL(request.url).origin;
    const projectIds = meeting.linkedProjectIds;
    const migrated = await loadOrgProjects(session.userId, ctx.organizationId, projectIds);

    let targets: IMeeting[] = [meeting];

    if (linkedProjectsChanged && meeting.googleRecurringEventId) {
      const siblings = await Meeting.find({
        userId: ctx.userId,
        googleRecurringEventId: meeting.googleRecurringEventId,
      });
      targets = siblings;
      for (const sibling of siblings) {
        sibling.linkedProjectIds = [...projectIds];
      }
    }

    for (const target of targets) {
      if (linkedProjectsChanged || target.linkedProjectIds.length > 0) {
        await syncMeetingAgendaToCalendar(ctx.userId, target, migrated, baseUrl);
      }
      await target.save();
    }

    const saved = await Meeting.findById(meeting._id).lean();
    const seriesUpdatedCount = targets.length;

    return NextResponse.json({
      ...(saved || meeting.toObject()),
      seriesUpdatedCount: linkedProjectsChanged ? seriesUpdatedCount : undefined,
    });
  } catch (error) {
    console.error('Meeting PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
