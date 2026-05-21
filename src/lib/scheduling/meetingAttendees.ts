import connectDB from '@/lib/db/mongodb';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { Types } from 'mongoose';

const MAX_ATTENDEES = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type SkippedAttendee = {
  id?: string;
  name: string;
  reason: string;
};

export type ResolvedMeetingInvitees = {
  attendeeEmployeeIds: Types.ObjectId[];
  externalAttendeeEmails: string[];
  googleAttendees: { email: string }[];
  invitedUserIds: Types.ObjectId[];
  skipped: SkippedAttendee[];
};

function normalizeEmail(email: string): string | null {
  const t = email.trim().toLowerCase();
  if (!t || !EMAIL_RE.test(t)) return null;
  return t;
}

export async function resolveMeetingInvitees(
  organizationId: string,
  employeeIds: string[] | undefined,
  externalEmails: string[] | undefined,
  organizerUserId?: string
): Promise<ResolvedMeetingInvitees> {
  await connectDB();

  const skipped: SkippedAttendee[] = [];
  const attendeeEmployeeIds: Types.ObjectId[] = [];
  const emailToEmployeeId = new Map<string, Types.ObjectId>();
  const invitedUserIds: Types.ObjectId[] = [];

  let organizerEmail: string | null = null;
  if (organizerUserId) {
    const organizer = await User.findById(organizerUserId).select('email').lean();
    organizerEmail = organizer?.email?.toLowerCase() ?? null;
  }

  const validEmployeeIds = (employeeIds || []).filter((id) => Types.ObjectId.isValid(id));
  if (validEmployeeIds.length > 0) {
    const employees = await Employee.find({
      organizationId,
      _id: { $in: validEmployeeIds.map((id) => new Types.ObjectId(id)) },
    }).lean();

    const userIds = employees
      .map((e) => e.userId)
      .filter((id): id is Types.ObjectId => id != null);

    const users =
      userIds.length > 0
        ? await User.find({ _id: { $in: userIds } }).select('email').lean()
        : [];
    const emailByUserId = new Map(users.map((u) => [u._id.toString(), u.email?.toLowerCase()]));

    for (const emp of employees) {
      const email =
        (emp.userId && emailByUserId.get(emp.userId.toString())) ||
        (emp.email ? emp.email.toLowerCase() : null);

      if (!email) {
        skipped.push({
          id: emp._id.toString(),
          name: emp.name,
          reason: 'No email on file',
        });
        continue;
      }

      if (organizerEmail && email === organizerEmail) {
        continue;
      }

      attendeeEmployeeIds.push(emp._id as Types.ObjectId);
      emailToEmployeeId.set(email, emp._id as Types.ObjectId);

      if (emp.userId && emp.userId.toString() !== organizerUserId) {
        const uid = emp.userId as Types.ObjectId;
        if (!invitedUserIds.some((u) => u.equals(uid))) {
          invitedUserIds.push(uid);
        }
      }
    }
  }

  const externalAttendeeEmails: string[] = [];
  for (const raw of externalEmails || []) {
    const email = normalizeEmail(String(raw));
    if (!email) {
      skipped.push({ name: String(raw), reason: 'Invalid email address' });
      continue;
    }
    if (organizerEmail && email === organizerEmail) {
      continue;
    }
    if (!externalAttendeeEmails.includes(email)) {
      externalAttendeeEmails.push(email);
    }
  }

  const googleAttendees: { email: string }[] = [];
  const seen = new Set<string>();

  for (const email of emailToEmployeeId.keys()) {
    if (!seen.has(email)) {
      seen.add(email);
      googleAttendees.push({ email });
    }
  }
  for (const email of externalAttendeeEmails) {
    if (!seen.has(email)) {
      seen.add(email);
      googleAttendees.push({ email });
    }
  }

  if (googleAttendees.length > MAX_ATTENDEES) {
    throw new Error(`A meeting can have at most ${MAX_ATTENDEES} invitees.`);
  }

  return {
    attendeeEmployeeIds,
    externalAttendeeEmails,
    googleAttendees,
    invitedUserIds,
    skipped,
  };
}
