import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import {
  listCalendarEvents,
  type GoogleCalendarEvent,
} from '@/lib/scheduling/googleCalendar';
import type { ExistingBookingLike } from '@/lib/onboarding/slotEngine';

export type OnboardingHostRef = {
  id: string;
  email: string;
};

export type HostCalendarLinkStatus = {
  hostId: string;
  email: string;
  status: 'connected' | 'user_not_found' | 'calendar_not_connected';
};

function googleEventToBusyInterval(
  event: GoogleCalendarEvent & { status?: string }
): { start: Date; end: Date } | null {
  if (event.status === 'cancelled') return null;

  if (event.start?.dateTime && event.end?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { start, end };
    }
  }

  if (event.start?.date && event.end?.date) {
    const start = new Date(`${event.start.date}T00:00:00.000Z`);
    const end = new Date(`${event.end.date}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { start, end };
    }
  }

  return null;
}

export async function getHostCalendarLinkStatuses(
  hosts: OnboardingHostRef[]
): Promise<HostCalendarLinkStatus[]> {
  await connectDB();
  const emails = hosts.map((h) => h.email.toLowerCase().trim()).filter(Boolean);
  const users = await User.find({ email: { $in: emails } })
    .select('_id email')
    .lean<{ _id: import('mongoose').Types.ObjectId; email?: string }[]>();

  const userIdByEmail = new Map(
    users.map((u) => [String(u.email ?? '').toLowerCase(), u._id])
  );

  const userIds = users.map((u) => u._id);
  const connections = userIds.length
    ? await UserCalendarConnection.find({ userId: { $in: userIds }, provider: 'google' })
        .select('userId')
        .lean<{ userId: import('mongoose').Types.ObjectId }[]>()
    : [];
  const connectedUserIds = new Set(connections.map((c) => String(c.userId)));

  return hosts.map((host) => {
    const email = host.email.toLowerCase().trim();
    const userId = userIdByEmail.get(email);
    if (!userId) {
      return { hostId: host.id, email: host.email, status: 'user_not_found' as const };
    }
    if (!connectedUserIds.has(String(userId))) {
      return { hostId: host.id, email: host.email, status: 'calendar_not_connected' as const };
    }
    return { hostId: host.id, email: host.email, status: 'connected' as const };
  });
}

/**
 * Fetches busy intervals from each host's linked Google Calendar (matched by host email → Nucleas user).
 */
export async function getHostCalendarBusyBlocks(
  hosts: OnboardingHostRef[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<ExistingBookingLike[]> {
  await connectDB();
  const blocks: ExistingBookingLike[] = [];

  const emails = hosts.map((h) => h.email.toLowerCase().trim()).filter(Boolean);
  if (emails.length === 0) return blocks;

  const users = await User.find({ email: { $in: emails } })
    .select('_id email')
    .lean<{ _id: import('mongoose').Types.ObjectId; email?: string }[]>();

  const userByEmail = new Map(
    users.map((u) => [String(u.email ?? '').toLowerCase(), u])
  );

  await Promise.all(
    hosts.map(async (host) => {
      const email = host.email.toLowerCase().trim();
      if (!email) return;
      const user = userByEmail.get(email);
      if (!user) return;

      const google = await getGoogleAccessTokenForUser(user._id);
      if (!google) return;

      try {
        const events = await listCalendarEvents(
          google.accessToken,
          google.calendarId,
          rangeStart.toISOString(),
          rangeEnd.toISOString()
        );
        for (const event of events) {
          const interval = googleEventToBusyInterval(event);
          if (!interval) continue;
          blocks.push({
            hostId: host.id,
            start: interval.start,
            end: interval.end,
            status: 'scheduled',
          });
        }
      } catch (error) {
        console.error('[onboarding] failed to load calendar busy times', host.email, error);
      }
    })
  );

  return blocks;
}
