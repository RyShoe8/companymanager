import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import Project from '@/lib/models/Project';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { buildMeetingAgenda } from '@/lib/scheduling/buildMeetingAgenda';
import {
  getOrganizationUserIds,
  migrateProjectFields,
  migrateStagesToTasks,
} from '@/lib/utils/apiHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await params;
    await connectDB();

    const meeting = await Meeting.findOne({ agendaToken: token }).lean();
    if (!meeting) {
      return NextResponse.json({ error: 'Agenda not found' }, { status: 404 });
    }

    if (meeting.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, ctx.organizationId);
    const projects = await Project.find({
      _id: { $in: meeting.linkedProjectIds },
      userId: { $in: orgUserIds },
    }).lean();
    const migrated = projects.map((p) => migrateProjectFields(migrateStagesToTasks(p)));

    const baseUrl = new URL(request.url).origin;
    const agendaUrl = `${baseUrl}/scheduling/agenda/${token}`;
    const payload = buildMeetingAgenda(
      {
        title: meeting.title,
        start: new Date(meeting.start),
        end: new Date(meeting.end),
        agendaUrl,
      },
      migrated as any
    );

    return NextResponse.json({
      meeting: {
        _id: meeting._id.toString(),
        title: meeting.title,
        start: meeting.start,
        end: meeting.end,
        agendaToken: meeting.agendaToken,
        linkedProjectIds: meeting.linkedProjectIds.map((id) => id.toString()),
      },
      agenda: payload,
    });
  } catch (error) {
    console.error('Agenda GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
