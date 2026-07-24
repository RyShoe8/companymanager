import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';

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
