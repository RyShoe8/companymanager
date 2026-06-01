import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import Project from '@/lib/models/Project';
import { getSchedulingContext, getUserSchedulingTimezone } from '@/lib/scheduling/schedulingContext';
import { generateAgendaToken } from '@/lib/scheduling/tokenCrypto';
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
import {
  insertCalendarEvent,
  listCalendarEvents,
} from '@/lib/scheduling/googleCalendar';
import { extractMeetingJoinUrl, type MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';
import {
  buildRecurrenceRule,
  getRecurrenceImportRangeEnd,
  type RecurrenceEnd,
  type RecurrencePreset,
  validateRecurrenceInput,
} from '@/lib/scheduling/recurrence';
import {
  filterSeriesInstances,
  importMeetingsForInvitedUsers,
  upsertMeetingsFromGoogleEvents,
} from '@/lib/scheduling/importGoogleMeetings';
import { resolveMeetingInvitees } from '@/lib/scheduling/meetingAttendees';
import { getOrgMeetingsViewer, listOrgMeetingsInRange } from '@/lib/scheduling/orgMeetingsQuery';
import { upsertMeetingSeriesSettings } from '@/lib/scheduling/seriesProjectLinks';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const scope = searchParams.get('scope') || 'user';

    await connectDB();

    if (scope === 'org') {
      if (!start || !end) {
        return NextResponse.json({ error: 'start and end are required for org scope' }, { status: 400 });
      }
      const viewer = await getOrgMeetingsViewer(session.userId);
      if (!viewer) {
        return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
      }
      const meetings = await listOrgMeetingsInRange(
        viewer,
        ctx.organizationId,
        new Date(start),
        new Date(end)
      );
      return NextResponse.json(meetings);
    }

    const query: Record<string, unknown> = { userId: ctx.userId };
    if (start && end) {
      const rangeStart = new Date(start);
      const rangeEnd = new Date(end);
      query.start = { $lt: rangeEnd };
      query.end = { $gt: rangeStart };
    }

    const meetings = await Meeting.find(query).sort({ start: 1 }).lean();
    return NextResponse.json(meetings);
  } catch (error) {
    console.error('Meetings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      start,
      end,
      linkedProjectIds,
      description,
      syncToGoogle,
      recurrence,
      attendeeEmployeeIds,
      externalAttendeeEmails,
      timeZone: bodyTimeZone,
    } = body;
    if (!title || !start || !end) {
      return NextResponse.json({ error: 'title, start, and end are required' }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return NextResponse.json({ error: 'Invalid start/end' }, { status: 400 });
    }

    const preset: RecurrencePreset =
      recurrence?.preset && recurrence.preset !== 'none' ? recurrence.preset : 'none';
    const recurrenceEnd: RecurrenceEnd = recurrence?.end || 'never';
    const untilDate = recurrence?.until ? new Date(recurrence.until) : undefined;
    const recurrenceCount =
      recurrence?.count != null ? Number(recurrence.count) : undefined;

    if (preset !== 'none') {
      const validationErr = validateRecurrenceInput({
        preset,
        start: startDate,
        end: recurrenceEnd,
        until: untilDate,
        count: recurrenceCount,
      });
      if (validationErr) {
        return NextResponse.json({ error: validationErr }, { status: 400 });
      }
    }

    const projectIds = Array.isArray(linkedProjectIds)
      ? linkedProjectIds.filter((id: string) => Types.ObjectId.isValid(id)).map((id: string) => new Types.ObjectId(id))
      : [];

    await connectDB();

    const schedulingTimeZone = await getUserSchedulingTimezone(ctx.userId, bodyTimeZone);

    let invitees;
    try {
      invitees = await resolveMeetingInvitees(
        ctx.organizationId,
        attendeeEmployeeIds,
        externalAttendeeEmails,
        session.userId
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid invitees';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const hasInvitees = invitees.googleAttendees.length > 0;
    if (hasInvitees && syncToGoogle === false) {
      return NextResponse.json(
        { error: 'Invites require Google Calendar sync.' },
        { status: 400 }
      );
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, ctx.organizationId);
    const projects = await Project.find({
      _id: { $in: projectIds },
      userId: { $in: orgUserIds },
    }).lean();
    const migrated = projects.map((p) => migrateProjectFields(migrateStagesToTasks(p)));

    const baseUrl = new URL(request.url).origin;
    const agendaToken = generateAgendaToken();
    const agendaUrl = `${baseUrl}/scheduling/agenda/${agendaToken}`;

    const agendaPayload = buildMeetingAgenda(
      { title: String(title).trim(), start: startDate, end: endDate, agendaUrl },
      migrated as any
    );
    const agendaText = formatAgendaPlainText(agendaPayload);
    const fullDescription = [description, agendaText].filter(Boolean).join('\n\n');

    const upsertInviteOptions = {
      linkedProjectIds: projectIds,
      attendeeEmployeeIds: invitees.attendeeEmployeeIds,
      externalAttendeeEmails: invitees.externalAttendeeEmails,
      createdInNucleas: true,
      defaultDescription: description || undefined,
    };

    const calendarEventBase = {
      summary: String(title).trim(),
      description: fullDescription,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      timeZone: schedulingTimeZone,
      ...(hasInvitees
        ? { attendees: invitees.googleAttendees, sendUpdates: 'all' as const }
        : {}),
    };

    if (preset !== 'none') {
      if (syncToGoogle === false) {
        return NextResponse.json(
          { error: 'Recurring meetings require Google Calendar sync.' },
          { status: 400 }
        );
      }

      const google = await getGoogleAccessTokenForUser(ctx.userId);
      if (!google) {
        return NextResponse.json(
          { error: 'Connect Google Calendar to create recurring meetings.' },
          { status: 400 }
        );
      }

      let recurrenceRules: string[];
      try {
        recurrenceRules = buildRecurrenceRule({
          preset,
          start: startDate,
          end: recurrenceEnd,
          until: untilDate,
          count: recurrenceCount,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid recurrence';
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      const created = await insertCalendarEvent(google.accessToken, google.calendarId, {
        ...calendarEventBase,
        recurrence: recurrenceRules,
      });

      const importEnd = getRecurrenceImportRangeEnd(startDate, recurrenceEnd, untilDate);
      const events = await listCalendarEvents(
        google.accessToken,
        google.calendarId,
        startDate.toISOString(),
        importEnd.toISOString()
      );
      const seriesEvents = filterSeriesInstances(events, created.id);

      const { imported, updated } = await upsertMeetingsFromGoogleEvents(ctx, seriesEvents, upsertInviteOptions);

      await importMeetingsForInvitedUsers({
        organizationId: ctx.organizationId,
        invitedUserIds: invitees.invitedUserIds,
        organizerUserId: ctx.userId,
        rangeStart: startDate,
        rangeEnd: importEnd,
        iCalUID: created.iCalUID,
        googleRecurringEventId: created.id,
        upsertOptions: upsertInviteOptions,
      });

      if (projectIds.length > 0) {
        await upsertMeetingSeriesSettings({
          organizationId: ctx.organizationId,
          googleRecurringEventId: created.id,
          iCalUID: created.iCalUID,
          linkedProjectIds: projectIds,
          agendaToken,
          attendeeEmployeeIds: invitees.attendeeEmployeeIds,
          externalAttendeeEmails: invitees.externalAttendeeEmails,
        });
      }

      const meetings = await Meeting.find({
        userId: ctx.userId,
        $or: [
          { googleRecurringEventId: created.id },
          { googleEventId: created.id },
        ],
      })
        .sort({ start: 1 })
        .lean();

      return NextResponse.json(
        {
          seriesId: created.id,
          imported,
          updated,
          instanceCount: meetings.length,
          meetings,
          invitesSent: invitees.googleAttendees.length,
          skippedAttendees: invitees.skipped,
        },
        { status: 201 }
      );
    }

    let googleEventId: string | undefined;
    let iCalUID: string | undefined;
    let joinUrl: string | undefined;
    let joinPlatform: MeetingJoinPlatform | undefined;
    if (syncToGoogle !== false) {
      const google = await getGoogleAccessTokenForUser(ctx.userId);
      if (!google && hasInvitees) {
        return NextResponse.json(
          { error: 'Connect Google Calendar to send meeting invites.' },
          { status: 400 }
        );
      }
      if (google) {
        const created = await insertCalendarEvent(google.accessToken, google.calendarId, calendarEventBase);
        googleEventId = created.id;
        iCalUID = created.iCalUID;
        const join = extractMeetingJoinUrl(created);
        if (join) {
          joinUrl = join.joinUrl;
          joinPlatform = join.joinPlatform;
        }

        if (hasInvitees) {
          const importEnd = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
          await importMeetingsForInvitedUsers({
            organizationId: ctx.organizationId,
            invitedUserIds: invitees.invitedUserIds,
            organizerUserId: ctx.userId,
            rangeStart: startDate,
            rangeEnd: importEnd,
            iCalUID: created.iCalUID,
            googleRecurringEventId: undefined,
            upsertOptions: upsertInviteOptions,
          });
        }
      }
    } else if (hasInvitees) {
      return NextResponse.json(
        { error: 'Invites require Google Calendar sync.' },
        { status: 400 }
      );
    }

    const meeting = await Meeting.create({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      title: String(title).trim(),
      start: startDate,
      end: endDate,
      googleEventId,
      iCalUID,
      agendaToken,
      linkedProjectIds: projectIds,
      attendeeEmployeeIds: invitees.attendeeEmployeeIds,
      externalAttendeeEmails: invitees.externalAttendeeEmails,
      createdInNucleas: true,
      description: description || undefined,
      ...(joinUrl ? { joinUrl, joinPlatform } : {}),
    });

    return NextResponse.json(
      {
        ...meeting.toObject(),
        invitesSent: invitees.googleAttendees.length,
        skippedAttendees: invitees.skipped,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Meetings POST error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
