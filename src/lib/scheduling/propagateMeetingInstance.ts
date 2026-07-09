import Meeting from '@/lib/models/Meeting';
import { normalizeMeetingTimestampMs } from '@/lib/scheduling/meetingDedupe';
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

export type LocalEditPropagationFields = {
  title: string;
  start: Date;
  end: Date;
  googleRecurringEventId?: string;
  googleEventId?: string;
  joinUrl?: string | null;
  joinPlatform?: string | null;
};

/** After a local instance edit, align org copies for this occurrence only (not the whole series). */
export async function propagateMeetingInstanceAfterLocalEdit(params: {
  organizationId: string;
  iCalUID?: string;
  googleRecurringEventId?: string;
  previousStart: Date;
  previousEnd: Date;
  fields: LocalEditPropagationFields;
}): Promise<number> {
  const iCalUID = params.iCalUID?.trim();
  if (!iCalUID) return 0;

  const filter: Record<string, unknown> = {
    organizationId: params.organizationId,
    iCalUID,
  };

  const seriesId = params.googleRecurringEventId?.trim();
  if (seriesId) {
    filter.googleRecurringEventId = seriesId;
    const oldStartMs = normalizeMeetingTimestampMs(params.previousStart);
    filter.start = {
      $gte: new Date(oldStartMs),
      $lt: new Date(oldStartMs + 60_000),
    };
  }

  const $set: Record<string, unknown> = {
    title: params.fields.title,
    start: params.fields.start,
    end: params.fields.end,
  };

  if (params.fields.googleRecurringEventId !== undefined) {
    $set.googleRecurringEventId = params.fields.googleRecurringEventId;
  }
  if (params.fields.googleEventId !== undefined) {
    $set.googleEventId = params.fields.googleEventId;
  }
  if (params.fields.joinUrl !== undefined) {
    $set.joinUrl = params.fields.joinUrl;
  }
  if (params.fields.joinPlatform !== undefined) {
    $set.joinPlatform = params.fields.joinPlatform;
  }

  const result = await Meeting.updateMany(filter, { $set });
  return result.modifiedCount ?? 0;
}
