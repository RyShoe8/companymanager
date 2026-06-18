import Meeting from '@/lib/models/Meeting';
import type { GoogleCalendarEvent } from '@/lib/scheduling/googleCalendar';

export type PropagateMeetingFields = {
  title: string;
  start: Date;
  end: Date;
  googleRecurringEventId?: string;
  joinUrl?: string | null;
  joinPlatform?: string | null;
};

/** Push synced instance times to all org copies sharing the same calendar identity. */
export async function propagateMeetingInstanceToOrgCopies(params: {
  organizationId: string;
  ev: GoogleCalendarEvent;
  fields: PropagateMeetingFields;
}): Promise<void> {
  const iCalUID = params.ev.iCalUID?.trim();
  if (!iCalUID) return;

  const isRecurringInstance = Boolean(params.ev.recurringEventId?.trim());
  const filter: Record<string, unknown> = {
    organizationId: params.organizationId,
    iCalUID,
  };

  if (isRecurringInstance) {
    filter.googleRecurringEventId = params.ev.recurringEventId!.trim();
  }

  const $set: Record<string, unknown> = {
    title: params.fields.title,
    start: params.fields.start,
    end: params.fields.end,
  };

  if (params.fields.googleRecurringEventId !== undefined) {
    $set.googleRecurringEventId = params.fields.googleRecurringEventId;
  }
  if (params.fields.joinUrl !== undefined) {
    $set.joinUrl = params.fields.joinUrl;
  }
  if (params.fields.joinPlatform !== undefined) {
    $set.joinPlatform = params.fields.joinPlatform;
  }

  await Meeting.updateMany(filter, { $set });
}
