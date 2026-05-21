import Meeting from '@/lib/models/Meeting';
import { GoogleCalendarEvent, listCalendarEvents, parseEventTimes } from '@/lib/scheduling/googleCalendar';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { generateAgendaToken } from '@/lib/scheduling/tokenCrypto';
import type { SchedulingContext } from '@/lib/scheduling/schedulingContext';
import { Types } from 'mongoose';

export type UpsertGoogleMeetingsOptions = {
  linkedProjectIds?: Types.ObjectId[];
  attendeeEmployeeIds?: Types.ObjectId[];
  externalAttendeeEmails?: string[];
  createdInNucleas?: boolean;
  defaultDescription?: string;
};

export type UpsertGoogleMeetingsResult = {
  imported: number;
  updated: number;
};

export async function loadExistingMeetingsByGoogleEventId(
  userId: Types.ObjectId
): Promise<Map<string, { _id: Types.ObjectId; linkedProjectIds: Types.ObjectId[] }>> {
  const existingByGoogleId = new Map<
    string,
    { _id: Types.ObjectId; linkedProjectIds: Types.ObjectId[] }
  >();
  const existing = await Meeting.find({
    userId,
    googleEventId: { $exists: true, $ne: null },
  }).select('googleEventId linkedProjectIds');
  for (const m of existing) {
    if (m.googleEventId) {
      existingByGoogleId.set(m.googleEventId, {
        _id: m._id,
        linkedProjectIds: m.linkedProjectIds || [],
      });
    }
  }
  return existingByGoogleId;
}

export async function upsertMeetingsFromGoogleEvents(
  ctx: SchedulingContext,
  events: GoogleCalendarEvent[],
  options: UpsertGoogleMeetingsOptions = {}
): Promise<UpsertGoogleMeetingsResult> {
  const {
    linkedProjectIds = [],
    attendeeEmployeeIds = [],
    externalAttendeeEmails = [],
    createdInNucleas = false,
    defaultDescription,
  } = options;

  const existingByGoogleId = await loadExistingMeetingsByGoogleEventId(ctx.userId);
  let imported = 0;
  let updated = 0;

  const attendeeFields =
    attendeeEmployeeIds.length > 0 || externalAttendeeEmails.length > 0
      ? {
          attendeeEmployeeIds,
          externalAttendeeEmails,
        }
      : {};

  for (const ev of events) {
    if (!ev.id) continue;
    const times = parseEventTimes(ev);
    if (!times) continue;

    const seriesFields = {
      googleRecurringEventId: ev.recurringEventId || undefined,
      iCalUID: ev.iCalUID || undefined,
    };

    const payload: Record<string, unknown> = {
      title: ev.summary?.trim() || 'Untitled meeting',
      start: times.start,
      end: times.end,
      ...seriesFields,
      ...attendeeFields,
    };

    const found = existingByGoogleId.get(ev.id);
    if (found) {
      const hasLinkedProjects = found.linkedProjectIds.length > 0;
      if (!hasLinkedProjects) {
        payload.description = ev.description ?? defaultDescription;
      }
      await Meeting.updateOne({ _id: found._id }, { $set: payload });
      updated++;
    } else {
      await Meeting.create({
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        ...payload,
        description: ev.description ?? defaultDescription,
        googleEventId: ev.id,
        agendaToken: generateAgendaToken(),
        linkedProjectIds,
        createdInNucleas,
      });
      imported++;
    }
  }

  return { imported, updated };
}

/** Instances belonging to a newly created recurring series. */
export function filterSeriesInstances(
  events: GoogleCalendarEvent[],
  seriesMasterId: string
): GoogleCalendarEvent[] {
  return events.filter((ev) => ev.id === seriesMasterId || ev.recurringEventId === seriesMasterId);
}

/** Events on an invitee calendar that match the organizer's shared meeting. */
export function filterEventsForSharedMeeting(
  events: GoogleCalendarEvent[],
  iCalUID?: string,
  googleRecurringEventId?: string
): GoogleCalendarEvent[] {
  return events.filter((ev) => {
    if (iCalUID && ev.iCalUID === iCalUID) return true;
    if (googleRecurringEventId) {
      return ev.recurringEventId === googleRecurringEventId || ev.id === googleRecurringEventId;
    }
    return false;
  });
}

export async function importMeetingsForInvitedUsers(params: {
  organizationId: string;
  invitedUserIds: Types.ObjectId[];
  organizerUserId: Types.ObjectId;
  rangeStart: Date;
  rangeEnd: Date;
  iCalUID?: string;
  googleRecurringEventId?: string;
  upsertOptions?: UpsertGoogleMeetingsOptions;
}): Promise<{ imported: number; updated: number }> {
  const {
    organizationId,
    invitedUserIds,
    organizerUserId,
    rangeStart,
    rangeEnd,
    iCalUID,
    googleRecurringEventId,
    upsertOptions = {},
  } = params;

  let totalImported = 0;
  let totalUpdated = 0;

  for (const userId of invitedUserIds) {
    if (userId.equals(organizerUserId)) continue;

    try {
      const google = await getGoogleAccessTokenForUser(userId);
      if (!google) continue;

      const events = await listCalendarEvents(
        google.accessToken,
        google.calendarId,
        rangeStart.toISOString(),
        rangeEnd.toISOString()
      );
      const matching = filterEventsForSharedMeeting(events, iCalUID, googleRecurringEventId);
      if (matching.length === 0) continue;

      const ctx: SchedulingContext = { userId, organizationId };
      const { imported, updated } = await upsertMeetingsFromGoogleEvents(ctx, matching, upsertOptions);
      totalImported += imported;
      totalUpdated += updated;
    } catch (error) {
      console.error('Failed to import meeting for invited user', userId.toString(), error);
    }
  }

  return { imported: totalImported, updated: totalUpdated };
}
