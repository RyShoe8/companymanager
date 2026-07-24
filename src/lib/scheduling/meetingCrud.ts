import Meeting, { IMeeting } from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import Project, { type IProject } from '@/lib/models/Project';
import Client from '@/lib/models/Client';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { extractMeetingJoinUrl } from '@/lib/scheduling/extractMeetingJoinUrl';
import {
  deleteCalendarEvent,
  updateCalendarEvent,
} from '@/lib/scheduling/googleCalendar';
import {
  buildMeetingFullDescription,
  pushMeetingDescriptionToGoogle,
} from '@/lib/scheduling/meetingCalendarSync';
import { stripNucleasAgendaFromDescription } from '@/lib/scheduling/meetingAgendaDescription';
import { propagateMeetingProjectsAndCalendars } from '@/lib/scheduling/meetingPropagation';
import { propagateMeetingInstanceAfterLocalEdit } from '@/lib/scheduling/propagateMeetingInstance';
import { resolveMeetingInvitees } from '@/lib/scheduling/meetingAttendees';
import type { MeetingVideoMode } from '@/lib/scheduling/meetingVideoConference';
import {
  inferVideoModeFromMeeting,
  normalizeVideoConferenceInput,
  type NormalizedVideoConference,
} from '@/lib/scheduling/meetingVideoConference';
import { upsertMeetingSeriesSettings } from '@/lib/scheduling/seriesProjectLinks';
import {
  diffNewlyLinkedProjects,
  ensureMeetingNotesDocsForProjects,
  type MeetingNotesResult,
} from '@/lib/scheduling/meetingNotesDoc';
import {
  getOrganizationUserIds,
  migrateProjectFields,
  migrateStagesToTasks,
} from '@/lib/utils/apiHelpers';
import { getUserSchedulingTimezone } from '@/lib/scheduling/schedulingContext';
import { Types } from 'mongoose';

export type MeetingUpdateScope = 'instance' | 'series';

export type MeetingUpdateInput = {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  linkedProjectIds?: string[];
  linkedClientIds?: string[];
  attendeeEmployeeIds?: string[];
  externalAttendeeEmails?: string[];
  videoMode?: MeetingVideoMode;
  joinUrl?: string;
  scope?: MeetingUpdateScope;
  timeZone?: string;
};

async function loadOrgClients(organizationId: string, clientIds: Types.ObjectId[]) {
  if (!clientIds.length) return [];
  const clients = await Client.find({
    _id: { $in: clientIds },
    organizationId,
  })
    .select('_id')
    .lean();
  return clients.map((c) => c._id as Types.ObjectId);
}

async function loadOrgProjects(
  userId: string,
  organizationId: string,
  projectIds: Types.ObjectId[]
) {
  const orgUserIds = await getOrganizationUserIds(userId, organizationId);
  const projects = await Project.find({
    _id: { $in: projectIds },
    userId: { $in: orgUserIds },
  }).lean();
  return projects.map((p) => migrateProjectFields(migrateStagesToTasks(p))) as unknown as IProject[];
}

function applyVideoToMeeting(
  meeting: IMeeting,
  video: NormalizedVideoConference
): void {
  if (video.videoMode === 'none') {
    meeting.joinUrl = undefined;
    meeting.joinPlatform = undefined;
    return;
  }
  if (video.videoMode === 'manual' && video.joinUrl) {
    meeting.joinUrl = video.joinUrl;
    meeting.joinPlatform = video.joinPlatform;
    return;
  }
  // google_meet joinUrl filled after calendar sync
}

async function syncGoogleEventForMeeting(params: {
  meeting: IMeeting;
  userId: Types.ObjectId;
  timeZone: string;
  video: NormalizedVideoConference;
  title: string;
  start: Date;
  end: Date;
  description: string;
  googleAttendees: { email: string }[];
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}): Promise<void> {
  const { meeting, userId, timeZone, video, title, start, end, description, googleAttendees, sendUpdates } =
    params;
  if (!meeting.googleEventId) return;

  const google = await getGoogleAccessTokenForUser(userId);
  if (!google) return;

  const location = video.videoMode === 'manual' ? video.joinUrl : video.videoMode === 'none' ? '' : undefined;

  const updated = await updateCalendarEvent(
    google.accessToken,
    google.calendarId,
    meeting.googleEventId,
    {
      summary: title,
      description,
      start: start.toISOString(),
      end: end.toISOString(),
      timeZone,
      attendees: googleAttendees,
      sendUpdates,
      addGoogleMeet: video.videoMode === 'google_meet',
      ...(location !== undefined ? { location } : {}),
    }
  );

  const join = extractMeetingJoinUrl(updated);
  if (updated.id && updated.id !== meeting.googleEventId) {
    meeting.googleEventId = updated.id;
  }
  if (join) {
    meeting.joinUrl = join.joinUrl;
    meeting.joinPlatform = join.joinPlatform;
  } else if (video.videoMode === 'manual' && video.joinUrl) {
    meeting.joinUrl = video.joinUrl;
    meeting.joinPlatform = video.joinPlatform;
  } else if (video.videoMode === 'none') {
    meeting.joinUrl = undefined;
    meeting.joinPlatform = undefined;
  }
}

async function applyMeetingNotesOnLinkChange(
  userId: string,
  meeting: IMeeting,
  previousLinkedProjectIds: string[]
): Promise<MeetingNotesResult | undefined> {
  const currentIds = (meeting.linkedProjectIds || []).map((id) => id.toString());
  const newlyLinked = diffNewlyLinkedProjects(previousLinkedProjectIds, currentIds);
  if (newlyLinked.length === 0) return undefined;

  const result = await ensureMeetingNotesDocsForProjects({
    userId,
    meeting,
    newlyLinkedProjectIds: newlyLinked,
  });

  if (result.created.length === 0 && !result.notice && result.shareWarnings.length === 0) {
    return undefined;
  }
  return result;
}

export async function updateMeetingRecord(params: {
  meeting: IMeeting;
  userId: string;
  organizationId: string;
  body: MeetingUpdateInput;
  baseUrl: string;
}): Promise<{
  meeting: IMeeting;
  participantsUpdatedCount?: number;
  calendarsPatchedCount?: number;
  seriesUpdatedCount?: number;
  meetingNotes?: MeetingNotesResult;
}> {
  const { meeting, userId, organizationId, body, baseUrl } = params;
  const previousLinkedProjectIds = (meeting.linkedProjectIds || []).map((id) => id.toString());
  const previousStart = new Date(meeting.start);
  const previousEnd = new Date(meeting.end);
  const scope: MeetingUpdateScope =
    body.scope === 'series' && meeting.googleRecurringEventId ? 'series' : 'instance';

  let video: NormalizedVideoConference | undefined;
  if (body.videoMode !== undefined) {
    const normalized = normalizeVideoConferenceInput(body.videoMode, body.joinUrl);
    if (!normalized.ok) {
      throw new Error(normalized.error);
    }
    video = normalized.value;
  }

  const linkedProjectsChanged =
    body.linkedProjectIds !== undefined && Array.isArray(body.linkedProjectIds);
  const linkedClientsChanged =
    body.linkedClientIds !== undefined && Array.isArray(body.linkedClientIds);

  const linkOnlyKeys = ['linkedProjectIds', 'linkedClientIds'];
  const isLinkOnlyUpdate =
    (linkedProjectsChanged || linkedClientsChanged) &&
    Object.keys(body).every((k) => linkOnlyKeys.includes(k));

  if (isLinkOnlyUpdate) {
    const projectIds = linkedProjectsChanged
      ? body.linkedProjectIds!
          .filter((pid) => Types.ObjectId.isValid(pid))
          .map((pid) => new Types.ObjectId(pid))
      : meeting.linkedProjectIds || [];
    const clientIdsRaw = linkedClientsChanged
      ? body.linkedClientIds!
          .filter((cid) => Types.ObjectId.isValid(cid))
          .map((cid) => new Types.ObjectId(cid))
      : meeting.linkedClientIds || [];
    const clientIds = linkedClientsChanged
      ? await loadOrgClients(organizationId, clientIdsRaw)
      : meeting.linkedClientIds || [];

    meeting.linkedProjectIds = projectIds;
    meeting.linkedClientIds = clientIds;
    await meeting.save();
    const migrated = await loadOrgProjects(userId, organizationId, projectIds);
    const result = await propagateMeetingProjectsAndCalendars({
      anchor: meeting,
      linkedProjectIds: projectIds,
      projects: migrated,
      baseUrl,
      syncCalendar: true,
    });
    await upsertMeetingSeriesSettings({
      organizationId,
      googleRecurringEventId: meeting.googleRecurringEventId,
      iCalUID: meeting.iCalUID,
      linkedProjectIds: projectIds,
      linkedClientIds: clientIds,
      agendaToken: meeting.agendaToken,
      attendeeEmployeeIds: meeting.attendeeEmployeeIds,
      externalAttendeeEmails: meeting.externalAttendeeEmails,
    });
    const meetingNotes = await applyMeetingNotesOnLinkChange(userId, meeting, previousLinkedProjectIds);
    return {
      meeting,
      participantsUpdatedCount: result.participantsUpdatedCount,
      calendarsPatchedCount: result.calendarsPatchedCount,
      seriesUpdatedCount: meeting.googleRecurringEventId
        ? result.participantsUpdatedCount
        : undefined,
      meetingNotes,
    };
  }

  if (body.title !== undefined) meeting.title = String(body.title).trim();
  if (body.start !== undefined) meeting.start = new Date(body.start);
  if (body.end !== undefined) meeting.end = new Date(body.end);
  if (body.description !== undefined) {
    const stripped = stripNucleasAgendaFromDescription(body.description);
    meeting.description = stripped || undefined;
  }

  if (linkedProjectsChanged) {
    meeting.linkedProjectIds = body.linkedProjectIds!
      .filter((pid) => Types.ObjectId.isValid(pid))
      .map((pid) => new Types.ObjectId(pid));
  }

  if (linkedClientsChanged) {
    const clientIdsRaw = body.linkedClientIds!
      .filter((cid) => Types.ObjectId.isValid(cid))
      .map((cid) => new Types.ObjectId(cid));
    meeting.linkedClientIds = await loadOrgClients(organizationId, clientIdsRaw);
  }

  let invitees;
  if (body.attendeeEmployeeIds !== undefined || body.externalAttendeeEmails !== undefined) {
    invitees = await resolveMeetingInvitees(
      organizationId,
      body.attendeeEmployeeIds ?? meeting.attendeeEmployeeIds?.map((id) => id.toString()),
      body.externalAttendeeEmails ?? meeting.externalAttendeeEmails,
      userId
    );
    meeting.attendeeEmployeeIds = invitees.attendeeEmployeeIds;
    meeting.externalAttendeeEmails = invitees.externalAttendeeEmails;
  }

  if (video) {
    applyVideoToMeeting(meeting, video);
  }

  const timeZone = await getUserSchedulingTimezone(new Types.ObjectId(userId), body.timeZone);
  const projectIds = meeting.linkedProjectIds || [];
  const clientIds = meeting.linkedClientIds || [];
  const migrated = await loadOrgProjects(userId, organizationId, projectIds);
  const fullDescription = buildMeetingFullDescription(meeting, migrated, baseUrl);
  const googleAttendees = invitees?.googleAttendees ?? [];

  const targets =
    scope === 'series' && meeting.googleRecurringEventId
      ? await Meeting.find({
          organizationId,
          googleRecurringEventId: meeting.googleRecurringEventId,
        })
      : [meeting];

  let calendarsPatchedCount = 0;

  if (scope === 'series' && meeting.googleRecurringEventId) {
    const masterEventId = meeting.googleRecurringEventId;
    const google = await getGoogleAccessTokenForUser(new Types.ObjectId(userId));
    if (google) {
      const location =
        video?.videoMode === 'manual'
          ? video.joinUrl
          : video?.videoMode === 'none'
            ? ''
            : undefined;
      const updated = await updateCalendarEvent(
        google.accessToken,
        google.calendarId,
        masterEventId,
        {
          summary: meeting.title,
          description: fullDescription,
          start: meeting.start.toISOString(),
          end: meeting.end.toISOString(),
          timeZone,
          attendees: googleAttendees.length ? googleAttendees : undefined,
          sendUpdates: googleAttendees.length ? 'all' : undefined,
          addGoogleMeet: video?.videoMode === 'google_meet',
          ...(location !== undefined ? { location } : {}),
        }
      );
      calendarsPatchedCount = 1;
      const join = extractMeetingJoinUrl(updated);
      if (join) {
        for (const target of targets) {
          target.joinUrl = join.joinUrl;
          target.joinPlatform = join.joinPlatform;
        }
      }
    }

    for (const target of targets) {
      target.title = meeting.title;
      target.description = meeting.description;
      target.attendeeEmployeeIds = [...(meeting.attendeeEmployeeIds || [])];
      target.externalAttendeeEmails = [...(meeting.externalAttendeeEmails || [])];
      target.linkedProjectIds = [...projectIds];
      target.linkedClientIds = [...clientIds];
      if (video?.videoMode === 'manual') {
        target.joinUrl = video.joinUrl;
        target.joinPlatform = video.joinPlatform;
      } else if (video?.videoMode === 'none') {
        target.joinUrl = undefined;
        target.joinPlatform = undefined;
      }
      if (target._id.toString() === meeting._id.toString()) {
        target.start = meeting.start;
        target.end = meeting.end;
      }
      await target.save();
    }

    await upsertMeetingSeriesSettings({
      organizationId,
      googleRecurringEventId: meeting.googleRecurringEventId,
      iCalUID: meeting.iCalUID,
      linkedProjectIds: projectIds,
      linkedClientIds: clientIds,
      agendaToken: meeting.agendaToken,
      attendeeEmployeeIds: meeting.attendeeEmployeeIds,
      externalAttendeeEmails: meeting.externalAttendeeEmails,
    });
  } else {
    if (
      video ||
      body.title !== undefined ||
      body.start !== undefined ||
      body.end !== undefined ||
      body.description !== undefined ||
      invitees
    ) {
      await syncGoogleEventForMeeting({
        meeting,
        userId: new Types.ObjectId(userId),
        timeZone,
        video: video ?? {
          videoMode: inferVideoModeFromMeeting(meeting),
          joinUrl: meeting.joinUrl,
          joinPlatform: meeting.joinPlatform,
        },
        title: meeting.title,
        start: meeting.start,
        end: meeting.end,
        description: fullDescription,
        googleAttendees,
        sendUpdates: googleAttendees.length ? 'all' : undefined,
      });
      calendarsPatchedCount = meeting.googleEventId ? 1 : 0;
    } else if (linkedProjectsChanged) {
      await pushMeetingDescriptionToGoogle(new Types.ObjectId(userId), meeting, fullDescription);
      calendarsPatchedCount = meeting.googleEventId ? 1 : 0;
    }
    await meeting.save();

    const timeChanged = body.start !== undefined || body.end !== undefined;
    if (scope === 'instance' && timeChanged && meeting.iCalUID) {
      await propagateMeetingInstanceAfterLocalEdit({
        organizationId,
        iCalUID: meeting.iCalUID,
        googleRecurringEventId: meeting.googleRecurringEventId,
        previousStart,
        previousEnd,
        fields: {
          title: meeting.title,
          start: meeting.start,
          end: meeting.end,
          googleRecurringEventId: meeting.googleRecurringEventId,
          googleEventId: meeting.googleEventId,
          joinUrl: meeting.joinUrl ?? null,
          joinPlatform: meeting.joinPlatform ?? null,
        },
      });
    }
  }

  const meetingNotes = await applyMeetingNotesOnLinkChange(userId, meeting, previousLinkedProjectIds);

  return {
    meeting,
    participantsUpdatedCount: scope === 'series' ? targets.length : undefined,
    calendarsPatchedCount,
    seriesUpdatedCount: scope === 'series' ? targets.length : undefined,
    meetingNotes,
  };
}

export async function deleteMeetingRecord(params: {
  meeting: IMeeting;
  userId: string;
  organizationId: string;
  scope: MeetingUpdateScope;
}): Promise<{ deletedCount: number; googleDeleted: boolean }> {
  const { meeting, userId, organizationId, scope } = params;
  const google = await getGoogleAccessTokenForUser(new Types.ObjectId(userId));
  let googleDeleted = false;

  if (scope === 'series' && meeting.googleRecurringEventId) {
    if (google) {
      await deleteCalendarEvent(
        google.accessToken,
        google.calendarId,
        meeting.googleRecurringEventId,
        { sendUpdates: 'all' }
      );
      googleDeleted = true;
    }
    const result = await Meeting.deleteMany({
      organizationId,
      googleRecurringEventId: meeting.googleRecurringEventId,
    });
    await MeetingSeriesSettings.deleteMany({
      organizationId,
      googleRecurringEventId: meeting.googleRecurringEventId,
    });
    return { deletedCount: result.deletedCount ?? 0, googleDeleted };
  }

  if (meeting.googleEventId && google) {
    await deleteCalendarEvent(google.accessToken, google.calendarId, meeting.googleEventId, {
      sendUpdates: 'all',
    });
    googleDeleted = true;
  }
  await Meeting.deleteOne({ _id: meeting._id });
  return { deletedCount: 1, googleDeleted };
}