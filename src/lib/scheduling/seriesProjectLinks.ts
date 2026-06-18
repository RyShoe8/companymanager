import Meeting from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { Types } from 'mongoose';

export type SeriesProjectDefaults = {
  linkedProjectIds: Types.ObjectId[];
  linkedClientIds: Types.ObjectId[];
  agendaToken: string;
  attendeeEmployeeIds: Types.ObjectId[];
  externalAttendeeEmails: string[];
};

export type SeriesIdentity = {
  googleRecurringEventId?: string;
  iCalUID?: string;
};

function hasSeriesKey(identity: SeriesIdentity): boolean {
  return !!(identity.googleRecurringEventId?.trim() || identity.iCalUID?.trim());
}

function mapDefaults(doc: {
  linkedProjectIds?: Types.ObjectId[];
  linkedClientIds?: Types.ObjectId[];
  agendaToken: string;
  attendeeEmployeeIds?: Types.ObjectId[];
  externalAttendeeEmails?: string[];
}): SeriesProjectDefaults | null {
  const linkedProjectIds = doc.linkedProjectIds || [];
  const linkedClientIds = doc.linkedClientIds || [];
  if (!linkedProjectIds.length && !linkedClientIds.length) return null;
  return {
    linkedProjectIds: [...linkedProjectIds],
    linkedClientIds: [...linkedClientIds],
    agendaToken: doc.agendaToken,
    attendeeEmployeeIds: [...(doc.attendeeEmployeeIds || [])],
    externalAttendeeEmails: [...(doc.externalAttendeeEmails || [])],
  };
}

export async function findSeriesProjectDefaults(
  organizationId: string,
  identity: SeriesIdentity
): Promise<SeriesProjectDefaults | null> {
  if (!hasSeriesKey(identity)) return null;

  const registryQuery: Record<string, unknown> = { organizationId };
  if (identity.googleRecurringEventId) {
    registryQuery.googleRecurringEventId = identity.googleRecurringEventId;
  } else if (identity.iCalUID) {
    registryQuery.iCalUID = identity.iCalUID;
  }

  const registry = await MeetingSeriesSettings.findOne(registryQuery)
    .sort({ updatedAt: -1 })
    .lean();
  if (registry) {
    const fromRegistry = mapDefaults(registry);
    if (fromRegistry) return fromRegistry;
  }

  const meetingQuery: Record<string, unknown> = {
    organizationId,
    $or: [
      { linkedProjectIds: { $exists: true, $ne: [] } },
      { linkedClientIds: { $exists: true, $ne: [] } },
    ],
  };
  if (identity.googleRecurringEventId) {
    meetingQuery.googleRecurringEventId = identity.googleRecurringEventId;
  } else if (identity.iCalUID) {
    meetingQuery.iCalUID = identity.iCalUID;
  }

  const sibling = await Meeting.findOne(meetingQuery).sort({ updatedAt: -1 }).lean();
  if (!sibling) return null;
  return mapDefaults(sibling);
}

export async function upsertMeetingSeriesSettings(params: {
  organizationId: string;
  googleRecurringEventId?: string;
  iCalUID?: string;
  linkedProjectIds: Types.ObjectId[];
  linkedClientIds?: Types.ObjectId[];
  agendaToken: string;
  attendeeEmployeeIds?: Types.ObjectId[];
  externalAttendeeEmails?: string[];
}): Promise<void> {
  const { organizationId, googleRecurringEventId, iCalUID, linkedProjectIds, linkedClientIds = [], agendaToken } =
    params;
  if (!linkedProjectIds.length && !linkedClientIds.length) return;
  if (!googleRecurringEventId?.trim() && !iCalUID?.trim()) return;

  const filter: Record<string, unknown> = { organizationId };
  if (googleRecurringEventId?.trim()) {
    filter.googleRecurringEventId = googleRecurringEventId.trim();
  } else if (iCalUID?.trim()) {
    filter.iCalUID = iCalUID.trim();
  } else {
    return;
  }

  await MeetingSeriesSettings.findOneAndUpdate(
    filter,
    {
      $set: {
        linkedProjectIds,
        linkedClientIds,
        agendaToken,
        attendeeEmployeeIds: params.attendeeEmployeeIds || [],
        externalAttendeeEmails: params.externalAttendeeEmails || [],
      },
    },
    { upsert: true, new: true }
  );
}

export function applySeriesDefaultsToNewMeeting(
  createPayload: Record<string, unknown>,
  defaults: SeriesProjectDefaults | null,
  explicitLinkedProjectIds: Types.ObjectId[],
  explicitLinkedClientIds: Types.ObjectId[] = []
): Record<string, unknown> {
  const linkedProjectIds =
    explicitLinkedProjectIds.length > 0 ? explicitLinkedProjectIds : defaults?.linkedProjectIds || [];
  const linkedClientIds =
    explicitLinkedClientIds.length > 0 ? explicitLinkedClientIds : defaults?.linkedClientIds || [];

  const next: Record<string, unknown> = {
    ...createPayload,
    linkedProjectIds,
    linkedClientIds,
  };

  if (defaults) {
    if (!next.attendeeEmployeeIds && defaults.attendeeEmployeeIds.length > 0) {
      next.attendeeEmployeeIds = defaults.attendeeEmployeeIds;
    }
    if (!next.externalAttendeeEmails && defaults.externalAttendeeEmails.length > 0) {
      next.externalAttendeeEmails = defaults.externalAttendeeEmails;
    }
  }

  return next;
}

export async function resolveAttendeesFromGoogleEmails(
  organizationId: string,
  rawEmails: string[],
  organizerUserId?: string
): Promise<{
  attendeeEmployeeIds: Types.ObjectId[];
  externalAttendeeEmails: string[];
}> {
  const emails = [...new Set(rawEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) {
    return { attendeeEmployeeIds: [], externalAttendeeEmails: [] };
  }

  let organizerEmail: string | null = null;
  if (organizerUserId) {
    const organizer = await User.findById(organizerUserId).select('email').lean();
    organizerEmail = organizer?.email?.toLowerCase() ?? null;
  }

  const employees = await Employee.find({ organizationId }).lean();
  const userIds = employees
    .map((e) => e.userId)
    .filter((id): id is Types.ObjectId => id != null);
  const users =
    userIds.length > 0
      ? await User.find({ _id: { $in: userIds } }).select('email').lean()
      : [];
  const emailByUserId = new Map(users.map((u) => [u._id.toString(), u.email?.toLowerCase()]));

  const emailToEmployeeId = new Map<string, Types.ObjectId>();

  for (const emp of employees) {
    let email: string | null = null;
    if (emp.userId) {
      email = emailByUserId.get(emp.userId.toString()) ?? null;
    }
    if (!email && emp.email) {
      email = emp.email.toLowerCase();
    }
    if (email) {
      emailToEmployeeId.set(email, emp._id as Types.ObjectId);
    }
  }

  const attendeeEmployeeIds: Types.ObjectId[] = [];
  const externalAttendeeEmails: string[] = [];

  for (const email of emails) {
    if (organizerEmail && email === organizerEmail) continue;
    const employeeId = emailToEmployeeId.get(email);
    if (employeeId) {
      if (!attendeeEmployeeIds.some((id) => id.equals(employeeId))) {
        attendeeEmployeeIds.push(employeeId);
      }
    } else if (!externalAttendeeEmails.includes(email)) {
      externalAttendeeEmails.push(email);
    }
  }

  return { attendeeEmployeeIds, externalAttendeeEmails };
}

export function extractGoogleAttendeeEmails(event: {
  attendees?: { email?: string; responseStatus?: string }[];
}): string[] {
  if (!event.attendees?.length) return [];
  return event.attendees
    .filter((a) => a.responseStatus !== 'declined')
    .map((a) => a.email?.trim())
    .filter((email): email is string => !!email);
}
