import type { MeetingNotesResult } from '@/lib/scheduling/meetingNotesDoc';

export type MeetingNotesFeedback = Pick<MeetingNotesResult, 'created' | 'notice'>;

export function parseMeetingNotesFeedback(data: unknown): MeetingNotesFeedback | undefined {
  if (!data || typeof data !== 'object' || !('meetingNotes' in data)) return undefined;
  const raw = (data as { meetingNotes?: unknown }).meetingNotes;
  if (!raw || typeof raw !== 'object') return undefined;
  const meetingNotes = raw as { created?: unknown; notice?: unknown };
  const created = Array.isArray(meetingNotes.created)
    ? meetingNotes.created.filter(
        (item): item is { projectId: string; assetId: string; name: string } =>
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
