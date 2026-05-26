import connectDB from '@/lib/db/mongodb';
import Meeting from '@/lib/models/Meeting';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { listCalendarEvents } from '@/lib/scheduling/googleCalendar';
import {
  removeMeetingsMissingFromGoogleSync,
  upsertMeetingsFromGoogleEvents,
} from '@/lib/scheduling/importGoogleMeetings';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { Types } from 'mongoose';

export type SyncMeetingsForUserResult = {
  userId: string;
  imported: number;
  updated: number;
  removed: number;
  error?: string;
};

export async function syncMeetingsForUser(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<SyncMeetingsForUserResult> {
  await connectDB();

  const ctx = await getSchedulingContext(userId);
  if (!ctx) {
    return { userId, imported: 0, updated: 0, removed: 0, error: 'User or organization not found' };
  }

  const google = await getGoogleAccessTokenForUser(ctx.userId);
  if (!google) {
    return { userId, imported: 0, updated: 0, removed: 0, error: 'Calendar not connected' };
  }

  const events = await listCalendarEvents(
    google.accessToken,
    google.calendarId,
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  );

  const { imported, updated } = await upsertMeetingsFromGoogleEvents(ctx, events, {
    createdInNucleas: false,
  });

  const googleEventIds = new Set(
    events.map((e) => e.id).filter((id): id is string => Boolean(id))
  );
  const removed = await removeMeetingsMissingFromGoogleSync(
    ctx.userId,
    rangeStart,
    rangeEnd,
    googleEventIds
  );

  await UserCalendarConnection.updateOne({ userId: ctx.userId }, { syncedAt: new Date() });

  return { userId, imported, updated, removed };
}

export async function listMeetingsForUserInRange(
  userId: string | Types.ObjectId,
  rangeStart: Date,
  rangeEnd: Date
) {
  return Meeting.find({
    userId,
    start: { $lt: rangeEnd },
    end: { $gt: rangeStart },
  })
    .sort({ start: 1 })
    .lean();
}

export async function syncAllConnectedCalendars(
  rangeStart: Date,
  rangeEnd: Date
): Promise<{
  synced: number;
  failed: number;
  results: SyncMeetingsForUserResult[];
}> {
  await connectDB();
  const connections = await UserCalendarConnection.find({}).select('userId').lean();
  const results: SyncMeetingsForUserResult[] = [];

  for (const connection of connections) {
    const userId = connection.userId.toString();
    try {
      const result = await syncMeetingsForUser(userId, rangeStart, rangeEnd);
      results.push(result);
    } catch (error) {
      results.push({
        userId,
        imported: 0,
        updated: 0,
        removed: 0,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  const synced = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;
  return { synced, failed, results };
}
