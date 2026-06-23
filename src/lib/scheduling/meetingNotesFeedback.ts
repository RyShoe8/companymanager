export type MeetingNotesAssetSummary = {
  projectId: string;
  assetId: string;
  name: string;
};

export type MeetingNotesFeedback = {
  created: MeetingNotesAssetSummary[];
  notice?: string;
};

export function parseMeetingNotesFeedback(data: unknown): MeetingNotesFeedback | undefined {
  if (!data || typeof data !== 'object' || !('meetingNotes' in data)) return undefined;
  const raw = (data as { meetingNotes?: unknown }).meetingNotes;
  if (!raw || typeof raw !== 'object') return undefined;
  const meetingNotes = raw as { created?: unknown; notice?: unknown };
  const created = Array.isArray(meetingNotes.created)
    ? meetingNotes.created.filter(
        (item): item is MeetingNotesAssetSummary =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as { projectId?: unknown }).projectId === 'string' &&
          typeof (item as { assetId?: unknown }).assetId === 'string' &&
          typeof (item as { name?: unknown }).name === 'string'
      )
    : [];
  const notice = typeof meetingNotes.notice === 'string' ? meetingNotes.notice : undefined;
  if (created.length === 0 && !notice) return undefined;
  return { created, notice };
}

export function appendMeetingNotesMessage(
  baseMessage: string,
  meetingNotes?: MeetingNotesFeedback | null
): string {
  if (!meetingNotes) return baseMessage;
  const parts: string[] = [baseMessage];
  if (meetingNotes.created.length > 0) {
    parts.push(
      meetingNotes.created.length === 1
        ? 'Meeting notes Doc created.'
        : `${meetingNotes.created.length} meeting notes Docs created.`
    );
  }
  if (meetingNotes.notice) {
    parts.push(meetingNotes.notice);
  }
  return parts.join(' ');
}
