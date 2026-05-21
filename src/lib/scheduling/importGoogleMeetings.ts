import Meeting from '@/lib/models/Meeting';
import { GoogleCalendarEvent, parseEventTimes } from '@/lib/scheduling/googleCalendar';
import { generateAgendaToken } from '@/lib/scheduling/tokenCrypto';
import type { SchedulingContext } from '@/lib/scheduling/schedulingContext';
import { Types } from 'mongoose';

export type UpsertGoogleMeetingsOptions = {
  linkedProjectIds?: Types.ObjectId[];
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
    createdInNucleas = false,
    defaultDescription,
  } = options;

  const existingByGoogleId = await loadExistingMeetingsByGoogleEventId(ctx.userId);
  let imported = 0;
  let updated = 0;

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
