import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import Project from '@/lib/models/Project';
import Asset from '@/lib/models/Asset';
import ContentItem from '@/lib/models/ContentItem';
import Employee from '@/lib/models/Employee';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { buildMeetingAgenda } from '@/lib/scheduling/buildMeetingAgenda';
import { buildMeetingDetailPayload } from '@/lib/scheduling/buildMeetingDetailPayload';
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

    let meeting = await Meeting.findOne({ agendaToken: token }).lean();
    let linkedProjectIds = meeting?.linkedProjectIds ?? [];

    if (!meeting) {
      const registry = await MeetingSeriesSettings.findOne({ agendaToken: token }).lean();
      if (!registry) {
        return NextResponse.json({ error: 'Agenda not found' }, { status: 404 });
      }

      if (registry.organizationId !== ctx.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const seriesQuery: Record<string, unknown> = {
        organizationId: registry.organizationId,
      };
      if (registry.googleRecurringEventId) {
        seriesQuery.googleRecurringEventId = registry.googleRecurringEventId;
      } else if (registry.iCalUID) {
        seriesQuery.iCalUID = registry.iCalUID;
      } else {
        return NextResponse.json({ error: 'Agenda not found' }, { status: 404 });
      }

      meeting = await Meeting.findOne(seriesQuery).sort({ start: 1 }).lean();
      if (!meeting) {
        return NextResponse.json({ error: 'Agenda not found' }, { status: 404 });
      }

      linkedProjectIds = registry.linkedProjectIds ?? [];
    } else if (meeting.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, ctx.organizationId);
    const projects = await Project.find({
      _id: { $in: linkedProjectIds },
      userId: { $in: orgUserIds },
    }).lean();
    const migrated = projects.map((p) => migrateProjectFields(migrateStagesToTasks(p)));

    const projectIds = linkedProjectIds.map((id) => id.toString());

    const contentItems =
      linkedProjectIds.length > 0
        ? await ContentItem.find({ projectId: { $in: linkedProjectIds } }).lean()
        : [];

    const assetsByProjectId = new Map<
      string,
      {
        _id: { toString(): string };
        name: string;
        type: string;
        url?: string;
        fileUrl?: string;
        linkedProjectId?: { toString(): string };
        linkedProjectTaskId?: { toString(): string };
        linkedContentItemId?: { toString(): string };
      }[]
    >();
    if (projectIds.length > 0) {
      const assets = await Asset.find({
        linkedProjectId: { $in: linkedProjectIds },
        userId: { $in: orgUserIds },
      })
        .sort({ createdAt: -1 })
        .lean();

      for (const asset of assets) {
        const pid = asset.linkedProjectId?.toString();
        if (!pid) continue;
        const list = assetsByProjectId.get(pid) || [];
        list.push(asset);
        assetsByProjectId.set(pid, list);
      }
    }

    const attendeeIds = meeting.attendeeEmployeeIds ?? [];
    const employees =
      attendeeIds.length > 0
        ? await Employee.find({ _id: { $in: attendeeIds } }).select('name').lean()
        : [];
    const invitees = {
      employees: employees.map((e) => ({
        id: e._id.toString(),
        name: e.name,
      })),
      externalEmails: meeting.externalAttendeeEmails ?? [],
    };

    const baseUrl = new URL(request.url).origin;
    const agendaUrl = `${baseUrl}/scheduling/agenda/${token}`;
    const meetingWindow = {
      title: meeting.title,
      start: new Date(meeting.start),
      end: new Date(meeting.end),
      agendaUrl,
      joinUrl: meeting.joinUrl,
      joinPlatform: meeting.joinPlatform,
    };
    const payload = buildMeetingAgenda(meetingWindow, migrated as any, contentItems as any);
    const detail = buildMeetingDetailPayload(
      meetingWindow,
      migrated as any,
      assetsByProjectId,
      contentItems as any,
      invitees
    );

    return NextResponse.json({
      meeting: {
        _id: meeting._id.toString(),
        title: meeting.title,
        start: meeting.start,
        end: meeting.end,
        agendaToken: token,
        linkedProjectIds: projectIds,
        joinUrl: meeting.joinUrl,
        joinPlatform: meeting.joinPlatform,
      },
      canManage: meeting.userId?.toString() === session.userId,
      agenda: payload,
      detail,
    });
  } catch (error) {
    console.error('Agenda GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
