import Meeting from '@/lib/models/Meeting';
import { GoogleCalendarEvent, listCalendarEvents, parseEventTimes } from '@/lib/scheduling/googleCalendar';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { generateAgendaToken } from '@/lib/scheduling/tokenCrypto';
import { extractMeetingJoinUrl } from '@/lib/scheduling/extractMeetingJoinUrl';
import type { SchedulingContext } from '@/lib/scheduling/schedulingContext';
import {
  applySeriesDefaultsToNewMeeting,
  extractGoogleAttendeeEmails,
  findSeriesProjectDefaults,
  resolveAttendeesFromGoogleEmails,
} from '@/lib/scheduling/seriesProjectLinks';
import { propagateMeetingInstanceToOrgCopies } from '@/lib/scheduling/propagateMeetingInstance';
import { stripNucleasAgendaFromDescription } from '@/lib/scheduling/meetingAgendaDescription';
import { Types } from 'mongoose';

export type UpsertGoogleMeetingsOptions = {
  linkedProjectIds?: Types.ObjectId[];
  linkedClientIds?: Types.ObjectId[];
  attendeeEmployeeIds?: Types.ObjectId[];
  externalAttendeeEmails?: string[];
  createdInNucleas?: boolean;
  defaultDescription?: string;
};

export type UpsertGoogleMeetingsResult = {
  imported: number;
  updated: number;
};

function descriptionForImport(
  evDescription: string | undefined,
  createdInNucleas: boolean,
  defaultDescription?: string
): string | undefined {
  if (createdInNucleas) {
    return defaultDescription || stripNucleasAgendaFromDescription(evDescription) || undefined;
  }
  const stripped = stripNucleasAgendaFromDescription(evDescription);
  return stripped || defaultDescription || undefined;
}

export async function loadExistingMeetingsByGoogleEventId(
  userId: Types.ObjectId
): Promise<
  Map<
    string,
    {
      _id: Types.ObjectId;
      linkedProjectIds: Types.ObjectId[];
      linkedClientIds: Types.ObjectId[];
      createdInNucleas: boolean;
    }
  >
> {
  const existingByGoogleId = new Map<
    string,
    {
      _id: Types.ObjectId;
      linkedProjectIds: Types.ObjectId[];
      linkedClientIds: Types.ObjectId[];
      createdInNucleas: boolean;
    }
  >();
  const existing = await Meeting.find({
    userId,
    googleEventId: { $exists: true, $ne: null },
  }).select('googleEventId linkedProjectIds linkedClientIds createdInNucleas');
  for (const m of existing) {
    if (m.googleEventId) {
      existingByGoogleId.set(m.googleEventId, {
        _id: m._id,
        linkedProjectIds: m.linkedProjectIds || [],
        linkedClientIds: m.linkedClientIds || [],
        createdInNucleas: m.createdInNucleas ?? false,
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
    linkedClientIds = [],
    attendeeEmployeeIds = [],
    externalAttendeeEmails = [],
    createdInNucleas = false,
    defaultDescription,
  } = options;

  const existingByGoogleId = await loadExistingMeetingsByGoogleEventId(ctx.userId);
  let imported = 0;
  let updated = 0;

  const explicitAttendeeFields =
    attendeeEmployeeIds.length > 0 || externalAttendeeEmails.length > 0
      ? {
          attendeeEmployeeIds,
          externalAttendeeEmails,
        }
      : null;

  for (const ev of events) {
    if (!ev.id) continue;
    const times = parseEventTimes(ev);
    if (!times) continue;

    const seriesFields = {
      googleRecurringEventId: ev.recurringEventId || undefined,
      iCalUID: ev.iCalUID || undefined,
    };

    let resolvedAttendees = explicitAttendeeFields;
    if (!resolvedAttendees) {
      const googleEmails = extractGoogleAttendeeEmails(ev);
      if (googleEmails.length > 0) {
        const resolved = await resolveAttendeesFromGoogleEmails(
          ctx.organizationId,
          googleEmails,
          ctx.userId.toString()
        );
        if (resolved.attendeeEmployeeIds.length > 0 || resolved.externalAttendeeEmails.length > 0) {
          resolvedAttendees = resolved;
        }
      }
    }

    const payload: Record<string, unknown> = {
      title: ev.summary?.trim() || 'Untitled meeting',
      start: times.start,
      end: times.end,
      ...seriesFields,
      ...(resolvedAttendees || {}),
    };

    const join = extractMeetingJoinUrl(ev);
    if (join) {
      payload.joinUrl = join.joinUrl;
      payload.joinPlatform = join.joinPlatform;
    } else {
      payload.joinUrl = null;
      payload.joinPlatform = null;
    }

    const found = existingByGoogleId.get(ev.id);
    if (found) {
      const hasLinkedProjects = found.linkedProjectIds.length > 0;
      const hasLinkedClients = found.linkedClientIds.length > 0;
      if (!found.createdInNucleas && !hasLinkedProjects) {
        payload.description = descriptionForImport(ev.description, false, defaultDescription);
      }
      if (!hasLinkedProjects && !hasLinkedClients) {
        // preserve explicit links from options when meeting has none yet
        if (linkedProjectIds.length > 0) {
          payload.linkedProjectIds = linkedProjectIds;
        }
        if (linkedClientIds.length > 0) {
          payload.linkedClientIds = linkedClientIds;
        }
      }
      await Meeting.updateOne({ _id: found._id }, { $set: payload });
      await propagateMeetingInstanceToOrgCopies({
        organizationId: ctx.organizationId,
        ev,
        fields: {
          title: payload.title as string,
          start: times.start,
          end: times.end,
          googleRecurringEventId: seriesFields.googleRecurringEventId,
          joinUrl: (payload.joinUrl as string | null) ?? undefined,
          joinPlatform: (payload.joinPlatform as string | null) ?? undefined,
        },
      });
      updated++;
    } else {
      const seriesDefaults = await findSeriesProjectDefaults(ctx.organizationId, seriesFields);
      const createPayload = applySeriesDefaultsToNewMeeting(
        {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          ...payload,
          description: descriptionForImport(ev.description, createdInNucleas, defaultDescription),
          googleEventId: ev.id,
          agendaToken: generateAgendaToken(),
          createdInNucleas,
        },
        seriesDefaults,
        linkedProjectIds,
        linkedClientIds
      );

      await Meeting.create(createPayload);
      await propagateMeetingInstanceToOrgCopies({
        organizationId: ctx.organizationId,
        ev,
        fields: {
          title: payload.title as string,
          start: times.start,
          end: times.end,
          googleRecurringEventId: seriesFields.googleRecurringEventId,
          joinUrl: (payload.joinUrl as string | null) ?? undefined,
          joinPlatform: (payload.joinPlatform as string | null) ?? undefined,
        },
      });
      imported++;
    }
  }

  return { imported, updated };
}

/**
 * Remove calendar-backed meetings for this user that overlap the sync window but no
 * longer appear on Google Calendar. Scoped to rangeStart/rangeEnd so we do not delete
 * meetings outside the fetched timeframe. Nucleas-only rows (no googleEventId) are kept.
 */
export async function removeMeetingsMissingFromGoogleSync(
  userId: Types.ObjectId,
  organizationId: string,
  rangeStart: Date,
  rangeEnd: Date,
  googleEventIdsPresent: Set<string>
): Promise<number> {
  const windowFilter = {
    start: { $lt: rangeEnd },
    end: { $gt: rangeStart },
  };

  const missingIdFilter: Record<string, unknown> = {
    $exists: true,
    $ne: null,
  };
  if (googleEventIdsPresent.size > 0) {
    missingIdFilter.$nin = [...googleEventIdsPresent];
  }

  const orphaned = await Meeting.find({
    userId,
    googleEventId: missingIdFilter,
    ...windowFilter,
  })
    .select('googleEventId')
    .lean();

  const orphanedGoogleEventIds = [
    ...new Set(
      orphaned
        .map((m) => m.googleEventId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  if (orphanedGoogleEventIds.length === 0) {
    return 0;
  }

  const result = await Meeting.deleteMany({
    organizationId,
    googleEventId: { $in: orphanedGoogleEventIds },
    ...windowFilter,
  });

  return result.deletedCount ?? 0;
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
