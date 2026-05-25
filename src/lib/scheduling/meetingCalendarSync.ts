import { IMeeting } from '@/lib/models/Meeting';
import { IProject } from '@/lib/models/Project';
import {
  buildMeetingAgenda,
  formatAgendaPlainText,
} from '@/lib/scheduling/buildMeetingAgenda';
import { patchCalendarEventDescription } from '@/lib/scheduling/googleCalendar';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { Types } from 'mongoose';

export function buildMeetingFullDescription(
  meeting: Pick<IMeeting, 'title' | 'start' | 'end' | 'description' | 'agendaToken'>,
  projects: IProject[],
  baseUrl: string,
  options?: { agendaTokenOverride?: string }
): string {
  const agendaToken = options?.agendaTokenOverride ?? meeting.agendaToken;
  const agendaUrl = `${baseUrl.replace(/\/$/, '')}/scheduling/agenda/${agendaToken}`;
  const agendaPayload = buildMeetingAgenda(
    {
      title: meeting.title,
      start: new Date(meeting.start),
      end: new Date(meeting.end),
      agendaUrl,
    },
    projects
  );
  const agendaText = formatAgendaPlainText(agendaPayload);
  return [meeting.description, agendaText].filter(Boolean).join('\n\n');
}

export async function pushMeetingDescriptionToGoogle(
  userId: Types.ObjectId,
  meeting: Pick<IMeeting, 'googleEventId'>,
  fullDescription: string
): Promise<void> {
  if (!meeting.googleEventId) return;
  const google = await getGoogleAccessTokenForUser(userId);
  if (!google) return;
  await patchCalendarEventDescription(
    google.accessToken,
    google.calendarId,
    meeting.googleEventId,
    fullDescription
  );
}
