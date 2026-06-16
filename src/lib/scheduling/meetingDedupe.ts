export type MeetingInstanceIdentity = {
  iCalUID?: string;
  googleRecurringEventId?: string;
  googleEventId?: string;
  start: Date | string;
  end: Date | string;
};

/** Floor timestamps to minute precision so per-user calendar copies dedupe reliably. */
export function normalizeMeetingTimestampMs(date: Date | string): number {
  const ms = new Date(date).getTime();
  if (Number.isNaN(ms)) return NaN;
  return Math.floor(ms / 60_000) * 60_000;
}

/**
 * Stable key for one calendar event instance across per-user Meeting rows.
 * Priority: iCalUID → recurring series + start → start+end → googleEventId + start.
 */
export function meetingInstanceDedupeKey(meeting: MeetingInstanceIdentity): string {
  const startMs = normalizeMeetingTimestampMs(meeting.start);
  const endMs = normalizeMeetingTimestampMs(meeting.end);

  if (meeting.iCalUID?.trim()) {
    return `ical:${meeting.iCalUID.trim()}:${startMs}`;
  }

  if (meeting.googleRecurringEventId?.trim()) {
    return `recur:${meeting.googleRecurringEventId.trim()}:${startMs}`;
  }

  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
    return `time:${startMs}:${endMs}`;
  }

  const googleEventId = meeting.googleEventId?.trim() || '';
  return `event:${googleEventId}:${startMs}`;
}
