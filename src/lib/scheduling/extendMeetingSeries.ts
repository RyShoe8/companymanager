import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { buildRecurrenceRule } from '@/lib/scheduling/recurrence';
import type { ExtendUnit } from '@/lib/recurrence/recurrenceHorizons';
import {
  expandExtensionDates,
  getInitialHorizonEnd,
  sortByDateAsc,
} from '@/lib/recurrence/recurrenceHorizons';
import {
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '@/lib/scheduling/googleCalendar';
import {
  filterSeriesInstances,
  upsertMeetingsFromGoogleEvents,
} from '@/lib/scheduling/importGoogleMeetings';
import Meeting from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import type { SchedulingContext } from '@/lib/scheduling/schedulingContext';

function parseRruleCount(recurrence: string[] | undefined): number | null {
  if (!recurrence?.length) return null;
  for (const line of recurrence) {
    const match = line.match(/COUNT=(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function inferPresetFromRrule(recurrence: string[] | undefined): RecurrencePreset {
  if (!recurrence?.length) return 'weekly';
  const rule = recurrence[0].toUpperCase();
  if (rule.includes('FREQ=DAILY')) return 'daily';
  if (rule.includes('INTERVAL=2')) return 'biweekly';
  if (rule.includes('FREQ=MONTHLY')) return 'monthly';
  if (rule.includes('FREQ=WEEKLY')) return 'weekly';
  return 'weekly';
}

export async function extendMeetingSeries(params: {
  ctx: SchedulingContext;
  accessToken: string;
  calendarId: string;
  googleRecurringEventId: string;
  unit: ExtendUnit;
}): Promise<{ addedCount: number; newTotalCount: number }> {
  const { ctx, accessToken, calendarId, googleRecurringEventId, unit } = params;

  const master = await getCalendarEvent(accessToken, calendarId, googleRecurringEventId);
  const seriesSettings = await MeetingSeriesSettings.findOne({
    organizationId: ctx.organizationId,
    googleRecurringEventId,
  }).lean();

  const preset =
    (seriesSettings?.recurrencePreset as RecurrencePreset | undefined) ??
    inferPresetFromRrule(master.recurrence);

  const instances = await Meeting.find({
    userId: ctx.userId,
    googleRecurringEventId,
  }).lean();

  if (instances.length === 0) {
    throw new Error('Series not found');
  }

  const nucleasCreated = instances.some((m) => m.createdInNucleas);
  if (!nucleasCreated) {
    throw new Error('Only Nucleas-created recurring meetings can be extended here.');
  }

  const sorted = sortByDateAsc(instances, (m) => new Date(m.start));
  const last = sorted[sorted.length - 1];
  const lastStart = new Date(last.start);
  const extensionDates = expandExtensionDates(lastStart, preset, unit);
  if (extensionDates.length === 0) {
    const currentCount =
      seriesSettings?.recurrenceCount ??
      parseRruleCount(master.recurrence) ??
      sorted.length;
    return { addedCount: 0, newTotalCount: currentCount };
  }

  const currentCount =
    seriesSettings?.recurrenceCount ??
    parseRruleCount(master.recurrence) ??
    sorted.length;
  const newCount = currentCount + extensionDates.length;

  const startDate = new Date(sorted[0].start);
  const recurrenceRules = buildRecurrenceRule({
    preset,
    start: startDate,
    end: 'after',
    count: newCount,
  });

  await updateCalendarEvent(accessToken, calendarId, googleRecurringEventId, {
    recurrence: recurrenceRules,
  });

  const importEnd = getInitialHorizonEnd(lastStart, preset);
  const extendedEnd = new Date(
    Math.max(importEnd.getTime(), extensionDates[extensionDates.length - 1].getTime())
  );

  const events = await listCalendarEvents(
    accessToken,
    calendarId,
    startDate.toISOString(),
    extendedEnd.toISOString()
  );
  const seriesEvents = filterSeriesInstances(events, googleRecurringEventId);

  await upsertMeetingsFromGoogleEvents(ctx, seriesEvents, {
    createdInNucleas: true,
  });

  await MeetingSeriesSettings.updateOne(
    { organizationId: ctx.organizationId, googleRecurringEventId },
    {
      $set: {
        recurrencePreset: preset,
        recurrenceCount: newCount,
      },
    }
  );

  return { addedCount: extensionDates.length, newTotalCount: newCount };
}

export async function upsertMeetingSeriesRecurrence(params: {
  organizationId: string;
  googleRecurringEventId: string;
  iCalUID?: string;
  preset: RecurrencePreset;
  recurrenceCount: number;
  agendaToken?: string;
}): Promise<void> {
  const { organizationId, googleRecurringEventId, iCalUID, preset, recurrenceCount, agendaToken } =
    params;
  if (!googleRecurringEventId?.trim()) return;

  const filter = { organizationId, googleRecurringEventId: googleRecurringEventId.trim() };
  const update: Record<string, unknown> = {
    $set: {
      recurrencePreset: preset,
      recurrenceCount,
      ...(iCalUID ? { iCalUID } : {}),
    },
  };
  if (agendaToken) {
    update.$setOnInsert = {
      agendaToken,
      linkedProjectIds: [],
      attendeeEmployeeIds: [],
      externalAttendeeEmails: [],
    };
  }

  await MeetingSeriesSettings.findOneAndUpdate(filter, update, { upsert: !!agendaToken });
}
