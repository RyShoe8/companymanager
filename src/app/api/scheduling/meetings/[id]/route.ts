import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import Project from '@/lib/models/Project';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import {
  buildMeetingAgenda,
  formatAgendaPlainText,
} from '@/lib/scheduling/buildMeetingAgenda';
import {
  getOrganizationUserIds,
  migrateProjectFields,
  migrateStagesToTasks,
} from '@/lib/utils/apiHelpers';
import { patchCalendarEventDescription } from '@/lib/scheduling/googleCalendar';
import { Types } from 'mongoose';

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

    if (body.linkedProjectIds !== undefined && Array.isArray(body.linkedProjectIds)) {
      meeting.linkedProjectIds = body.linkedProjectIds
        .filter((pid: string) => Types.ObjectId.isValid(pid))
        .map((pid: string) => new Types.ObjectId(pid));
    }

    const baseUrl = new URL(request.url).origin;
    const agendaUrl = `${baseUrl}/scheduling/agenda/${meeting.agendaToken}`;
    const orgUserIds = await getOrganizationUserIds(session.userId, ctx.organizationId);
    const projects = await Project.find({
      _id: { $in: meeting.linkedProjectIds },
      userId: { $in: orgUserIds },
    }).lean();
    const migrated = projects.map((p) => migrateProjectFields(migrateStagesToTasks(p)));
    const agendaPayload = buildMeetingAgenda(
      {
        title: meeting.title,
        start: meeting.start,
        end: meeting.end,
        agendaUrl,
      },
      migrated as any
    );
    const agendaText = formatAgendaPlainText(agendaPayload);
    const fullDescription = [meeting.description, agendaText].filter(Boolean).join('\n\n');

    if (meeting.googleEventId) {
      const google = await getGoogleAccessTokenForUser(ctx.userId);
      if (google) {
        await patchCalendarEventDescription(
          google.accessToken,
          google.calendarId,
          meeting.googleEventId,
          fullDescription
        );
      }
    }

    await meeting.save();
    return NextResponse.json(meeting.toObject());
  } catch (error) {
    console.error('Meeting PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
