import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import Project from '@/lib/models/Project';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import {
  getOrganizationUserIds,
  migrateProjectFields,
  migrateStagesToTasks,
} from '@/lib/utils/apiHelpers';
import { propagateMeetingProjectsAndCalendars } from '@/lib/scheduling/meetingPropagation';
import { upsertMeetingSeriesSettings } from '@/lib/scheduling/seriesProjectLinks';
import { getAppBaseUrl } from '@/lib/utils/invitation';
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

    let participantsUpdatedCount: number | undefined;
    let calendarsPatchedCount: number | undefined;
    let seriesUpdatedCount: number | undefined;

    if (linkedProjectsChanged) {
      const projectIds = body.linkedProjectIds
        .filter((pid: string) => Types.ObjectId.isValid(pid))
        .map((pid: string) => new Types.ObjectId(pid));

      meeting.linkedProjectIds = projectIds;

      const baseUrl = getAppBaseUrl();
      const migrated = await loadOrgProjects(session.userId, ctx.organizationId, projectIds);

      const result = await propagateMeetingProjectsAndCalendars({
        anchor: meeting,
        linkedProjectIds: projectIds,
        projects: migrated,
        baseUrl,
        syncCalendar: true,
      });

      participantsUpdatedCount = result.participantsUpdatedCount;
      calendarsPatchedCount = result.calendarsPatchedCount;
      seriesUpdatedCount = meeting.googleRecurringEventId
        ? result.participantsUpdatedCount
        : undefined;

      await upsertMeetingSeriesSettings({
        organizationId: ctx.organizationId,
        googleRecurringEventId: meeting.googleRecurringEventId,
        iCalUID: meeting.iCalUID,
        linkedProjectIds: projectIds,
        agendaToken: meeting.agendaToken,
        attendeeEmployeeIds: meeting.attendeeEmployeeIds,
        externalAttendeeEmails: meeting.externalAttendeeEmails,
      });
    } else {
      await meeting.save();
    }

    const saved = await Meeting.findById(meeting._id).lean();

    return NextResponse.json({
      ...(saved || meeting.toObject()),
      participantsUpdatedCount,
      calendarsPatchedCount,
      seriesUpdatedCount,
    });
  } catch (error) {
    console.error('Meeting PATCH error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: 'Meeting update conflict. Please refresh and try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
