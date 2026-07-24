import Meeting, { IMeeting } from '@/lib/models/Meeting';
import { IProject } from '@/lib/models/Project';
import {
  buildMeetingFullDescription,
  pushMeetingDescriptionToGoogle,
} from '@/lib/scheduling/meetingCalendarSync';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { Types } from 'mongoose';

type MeetingAnchor = Pick<
  IMeeting,
  | '_id'
  | 'organizationId'
  | 'iCalUID'
  | 'googleRecurringEventId'
  | 'start'
  | 'end'
  | 'agendaToken'
  | 'userId'
  | 'googleEventId'
  | 'title'
  | 'description'
  | 'attendeeEmployeeIds'
  | 'externalAttendeeEmails'
>;

/**
 * All org Meeting rows that should share linked projects / agenda for this calendar event.
 * Recurring: entire series in the org (all instance dates, all users who synced).
 * Non-recurring: same iCalUID across users, else editor only.
 */
async function findMeetingsForProjectPropagation(
  anchor: MeetingAnchor
): Promise<IMeeting[]> {
  const { organizationId } = anchor;

  if (anchor.googleRecurringEventId) {
    return Meeting.find({
      organizationId,
      googleRecurringEventId: anchor.googleRecurringEventId,
    });
  }

  if (anchor.iCalUID) {
    return Meeting.find({ organizationId, iCalUID: anchor.iCalUID });
  }

  const single = await Meeting.findById(anchor._id);
  return single ? [single] : [];
}

export type PropagateMeetingProjectsResult = {
  participantsUpdatedCount: number;
  calendarsPatchedCount: number;
};

export async function propagateMeetingProjectsAndCalendars(params: {
  anchor: MeetingAnchor;
  linkedProjectIds: Types.ObjectId[];
  projects: IProject[];
  baseUrl: string;
  syncCalendar: boolean;
}): Promise<PropagateMeetingProjectsResult> {
  const { anchor, linkedProjectIds, projects, baseUrl, syncCalendar } = params;
  const targets = await findMeetingsForProjectPropagation(anchor);
  const canonicalAgendaToken = anchor.agendaToken;

  let calendarsPatchedCount = 0;

  for (const target of targets) {
    target.linkedProjectIds = [...linkedProjectIds];
    if (anchor.attendeeEmployeeIds?.length) {
      target.attendeeEmployeeIds = [...anchor.attendeeEmployeeIds];
    }
    if (anchor.externalAttendeeEmails?.length) {
      target.externalAttendeeEmails = [...anchor.externalAttendeeEmails];
    }

    if (syncCalendar && target.linkedProjectIds.length > 0 && target.googleEventId) {
      const fullDescription = buildMeetingFullDescription(target, projects, baseUrl, {
        agendaTokenOverride: canonicalAgendaToken,
      });
      try {
        const google = await getGoogleAccessTokenForUser(target.userId);
        if (google) {
          await pushMeetingDescriptionToGoogle(target.userId, target, fullDescription);
          calendarsPatchedCount += 1;
        }
      } catch (error) {
        console.error('Failed to patch calendar for meeting', target._id, error);
      }
    }

    await target.save();
  }

  return {
    participantsUpdatedCount: targets.length,
    calendarsPatchedCount,
  };
}
