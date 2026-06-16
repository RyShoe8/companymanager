export type MeetingInstanceIdentity = {
  iCalUID?: string;
  googleRecurringEventId?: string;
  googleEventId?: string;
  start: Date | string;
  end: Date | string;
};

/**
 * Stable key for one calendar event instance across per-user Meeting rows.
 * Priority: iCalUID → recurring series + start → start+end → googleEventId + start.
 */
export function meetingInstanceDedupeKey(meeting: MeetingInstanceIdentity): string {
  const startMs = new Date(meeting.start).getTime();
  const endMs = new Date(meeting.end).getTime();

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
