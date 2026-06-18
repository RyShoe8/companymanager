import Employee from '@/lib/models/Employee';
import Meeting from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import User from '@/lib/models/User';
import { meetingInstanceDedupeKey } from '@/lib/scheduling/meetingDedupe';
import { meetingPassesAssignmentFilter as meetingPassesAssignmentFilterShared } from '@/lib/scheduling/meetingHours';
import { Types } from 'mongoose';

import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';

export type OrgMeetingRecord = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: string;
  title: string;
  start: Date;
  end: Date;
  googleEventId?: string;
  googleRecurringEventId?: string;
  iCalUID?: string;
  agendaToken: string;
  linkedProjectIds?: Types.ObjectId[];
  linkedClientIds?: Types.ObjectId[];
  attendeeEmployeeIds?: Types.ObjectId[];
  joinUrl?: string;
  joinPlatform?: MeetingJoinPlatform;
  createdInNucleas?: boolean;
  seriesRecurrenceCount?: number;
  updatedAt?: Date;
};

export type OrgMeetingsViewer = {
  userId: string;
  role: 'Administrator' | 'Manager' | 'User';
  employeeId: string | null;
};

export async function getOrgMeetingsViewer(userId: string): Promise<OrgMeetingsViewer | null> {
  const user = await User.findById(userId).lean();
  if (!user?.organizationId) return null;

  const employee = await Employee.findOne({
    userId: user._id,
    organizationId: user.organizationId,
  })
    .select('_id role')
    .lean();

  return {
    userId: user._id.toString(),
    role: (employee?.role as OrgMeetingsViewer['role']) || 'User',
    employeeId: employee?._id?.toString() ?? null,
  };
}

async function getVisibleEmployeeIds(viewer: OrgMeetingsViewer): Promise<string[] | null> {
  const user = await User.findById(viewer.userId).lean();
  if (!user?.organizationId) return [];

  if (viewer.role === 'Administrator' || viewer.role === 'Manager') {
    const employees = await Employee.find({
      organizationId: user.organizationId,
      userId: { $exists: true, $ne: null },
    })
      .select('_id')
      .lean();
    return employees.map((e) => e._id.toString());
  }

  return viewer.employeeId ? [viewer.employeeId] : [];
}

function linkScore(meeting: OrgMeetingRecord): number {
  return (meeting.linkedProjectIds?.length || 0) + (meeting.linkedClientIds?.length || 0);
}

function preferOrgMeeting(
  candidate: OrgMeetingRecord,
  existing: OrgMeetingRecord,
  viewerUserId: string
): boolean {
  const candidateIsViewer = candidate.userId?.toString() === viewerUserId;
  const existingIsViewer = existing.userId?.toString() === viewerUserId;
  if (candidateIsViewer && !existingIsViewer) return true;
  if (existingIsViewer && !candidateIsViewer) return false;

  const candidateLinks = linkScore(candidate);
  const existingLinks = linkScore(existing);
  if (candidateLinks > existingLinks) return true;
  if (candidateLinks < existingLinks) return false;

  const candidateUpdated = candidate.updatedAt ? new Date(candidate.updatedAt).getTime() : 0;
  const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
  return candidateUpdated >= existingUpdated;
}

export async function listOrgMeetingsInRange(
  viewer: OrgMeetingsViewer,
  organizationId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<OrgMeetingRecord[]> {
  const visibleEmployeeIds = await getVisibleEmployeeIds(viewer);
  if (visibleEmployeeIds === null) return [];

  const visibleObjectIds = visibleEmployeeIds.map((id) => new Types.ObjectId(id));
  const viewerUserId = new Types.ObjectId(viewer.userId);

  const orClauses: Record<string, unknown>[] = [{ userId: viewerUserId }];
  if (visibleObjectIds.length > 0) {
    orClauses.push({ attendeeEmployeeIds: { $in: visibleObjectIds } });
  }

  const meetings = await Meeting.find({
    organizationId,
    start: { $lt: rangeEnd },
    end: { $gt: rangeStart },
    $or: orClauses,
  })
    .sort({ start: 1 })
    .lean();

  const deduped = new Map<string, OrgMeetingRecord>();
  for (const meeting of meetings as OrgMeetingRecord[]) {
    const key = meetingInstanceDedupeKey(meeting);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, meeting);
      continue;
    }
    const preferCurrent = preferOrgMeeting(meeting, existing, viewer.userId);
    if (preferCurrent) {
      deduped.set(key, meeting);
    }
  }

  return [...deduped.values()].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

export async function attachSeriesRecurrenceCounts(
  organizationId: string,
  meetings: OrgMeetingRecord[]
): Promise<OrgMeetingRecord[]> {
  const seriesIds = [
    ...new Set(
      meetings
        .map((m) => m.googleRecurringEventId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  if (seriesIds.length === 0) return meetings;

  const settings = await MeetingSeriesSettings.find({
    organizationId,
    googleRecurringEventId: { $in: seriesIds },
  })
    .select('googleRecurringEventId recurrenceCount')
    .lean();

  const countBySeries = new Map(
    settings.map((s) => [s.googleRecurringEventId, s.recurrenceCount])
  );

  return meetings.map((meeting) => {
    const seriesId = meeting.googleRecurringEventId;
    if (!seriesId) return meeting;
    const count = countBySeries.get(seriesId);
    return count != null ? { ...meeting, seriesRecurrenceCount: count } : meeting;
  });
}

export function meetingPassesAssignmentFilter(
  meeting: Pick<OrgMeetingRecord, 'userId' | 'attendeeEmployeeIds'>,
  options: {
    showOnlyMyAssignments: boolean;
    currentUserEmployeeId: string | null;
    currentUserId: string | null;
  }
): boolean {
  return meetingPassesAssignmentFilterShared(meeting, options);
}
