import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import Project from '@/lib/models/Project';
import Client from '@/lib/models/Client';
import Asset from '@/lib/models/Asset';
import ContentItem from '@/lib/models/ContentItem';
import Employee from '@/lib/models/Employee';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { buildMeetingAgenda } from '@/lib/scheduling/buildMeetingAgenda';
import { buildMeetingDetailPayload } from '@/lib/scheduling/buildMeetingDetailPayload';
import { resolveMeetingLinkedProjectIds } from '@/lib/scheduling/resolveMeetingLinkedProjectIds';
import type { IProject } from '@/lib/models/Project';
import type { IClient } from '@/lib/models/Client';
import type { IContentItem } from '@/lib/models/ContentItem';
import { canUserContributeToProject } from '@/lib/utils/projectTeam';
import {
  getOrganizationUserIds,
  migrateProjectFields,
  migrateStagesToTasks,
} from '@/lib/utils/apiHelpers';
import { Types } from 'mongoose';

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
    let linkedClientIds = meeting?.linkedClientIds ?? [];

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
      linkedClientIds = registry.linkedClientIds ?? [];
    } else if (meeting.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, ctx.organizationId);

    const clientProjects =
      linkedClientIds.length > 0
        ? await Project.find({
            clientId: { $in: linkedClientIds },
            userId: { $in: orgUserIds },
          }).lean()
        : [];

    const linkedClients =
      linkedClientIds.length > 0
        ? await Client.find({
            _id: { $in: linkedClientIds },
            organizationId: ctx.organizationId,
          })
            .select('url urls devUrl liveUrl socialLinks techStack marketingStack platformStacks actionButtons')
            .lean()
        : [];

    const mergedProjectIdStrings = resolveMeetingLinkedProjectIds(
      linkedProjectIds,
      linkedClientIds,
      clientProjects as unknown as IProject[]
    );
    const mergedProjectIds = mergedProjectIdStrings
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const projects =
      mergedProjectIds.length > 0
        ? await Project.find({
            _id: { $in: mergedProjectIds },
            userId: { $in: orgUserIds },
          }).lean()
        : [];
    const migrated = projects.map((p) => migrateProjectFields(migrateStagesToTasks(p)));

    const projectIds = mergedProjectIdStrings;

    const contentItems =
      mergedProjectIds.length > 0
        ? await ContentItem.find({ projectId: { $in: mergedProjectIds } }).lean()
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
    if (mergedProjectIds.length > 0) {
      const assets = await Asset.find({
        linkedProjectId: { $in: mergedProjectIds },
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

    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: ctx.organizationId,
    }).lean();
    const isManagerOrAdmin =
      currentUserEmployee?.role === 'Administrator' ||
      currentUserEmployee?.role === 'Manager';

    const canContributeByProjectId: Record<string, boolean> = {};
    for (const project of migrated) {
      const pid = project._id.toString();
      canContributeByProjectId[pid] = canUserContributeToProject(
        project as Parameters<typeof canUserContributeToProject>[0],
        currentUserEmployee?._id?.toString() ?? null,
        !!isManagerOrAdmin
      );
    }

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
    const migratedProjects = migrated as unknown as IProject[];
    const typedContentItems = contentItems as unknown as IContentItem[];
    const typedLinkedClients = linkedClients as unknown as IClient[];
    const payload = buildMeetingAgenda(meetingWindow, migratedProjects, typedContentItems);
    const detail = buildMeetingDetailPayload(
      meetingWindow,
      migratedProjects,
      assetsByProjectId,
      typedContentItems,
      invitees,
      typedLinkedClients
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
      canContributeByProjectId,
      agenda: payload,
      detail,
    });
  } catch (error) {
    console.error('Agenda GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
