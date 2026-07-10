import connectDB from '@/lib/db/mongodb';
import Meeting from '@/lib/models/Meeting';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { listCalendarEvents } from '@/lib/scheduling/googleCalendar';
import {
  removeMeetingsMissingFromGoogleSync,
  upsertMeetingsFromGoogleEvents,
} from '@/lib/scheduling/importGoogleMeetings';
import {
  getDesiredSyncWindow,
  getFullSyncChunks,
  getMeetingRetentionWindow,
  getSyncGapChunks,
  type DateRange,
} from '@/lib/scheduling/meetingSyncHorizon';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { Types } from 'mongoose';

export type SyncMeetingsForUserResult = {
  userId: string;
  imported: number;
  updated: number;
  removed: number;
  error?: string;
};

export type EnsureMeetingSyncHorizonResult = SyncMeetingsForUserResult & {
  chunksSynced: number;
  syncHorizonEnd?: string;
};

export function mergeSyncCounts(
  a: Pick<SyncMeetingsForUserResult, 'imported' | 'updated' | 'removed'>,
  b: Pick<SyncMeetingsForUserResult, 'imported' | 'updated' | 'removed'>
): Pick<SyncMeetingsForUserResult, 'imported' | 'updated' | 'removed'> {
  return {
    imported: a.imported + b.imported,
    updated: a.updated + b.updated,
    removed: a.removed + b.removed,
  };
}

export async function syncUserMeetingsWithHorizon(
  userId: string,
  viewRange: DateRange
): Promise<EnsureMeetingSyncHorizonResult> {
  const horizonResult = await ensureMeetingSyncHorizon(userId, { viewEnd: viewRange.end });
  if (horizonResult.error) {
    return horizonResult;
  }

  const viewResult = await syncMeetingsForUser(userId, viewRange.start, viewRange.end);
  if (viewResult.error) {
    return {
      ...viewResult,
      chunksSynced: horizonResult.chunksSynced,
      syncHorizonEnd: horizonResult.syncHorizonEnd,
    };
  }

  const merged = mergeSyncCounts(horizonResult, viewResult);
  return {
    userId,
    ...merged,
    chunksSynced: horizonResult.chunksSynced,
    syncHorizonEnd: horizonResult.syncHorizonEnd,
  };
}

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
    ctx.organizationId,
    rangeStart,
    rangeEnd,
    googleEventIds
  );

  await UserCalendarConnection.updateOne({ userId: ctx.userId }, { syncedAt: new Date() });

  return { userId, imported, updated, removed };
}

async function pruneMeetingsOutsideRetention(
  userId: Types.ObjectId,
  organizationId: string
): Promise<void> {
  const { start, end } = getMeetingRetentionWindow();
  await Meeting.deleteMany({
    userId,
    organizationId,
    googleEventId: { $exists: true, $ne: null },
    $or: [{ end: { $lt: start } }, { start: { $gt: end } }],
  });
}

export async function ensureMeetingSyncHorizon(
  userId: string,
  options?: { viewEnd?: Date }
): Promise<EnsureMeetingSyncHorizonResult> {
  await connectDB();

  const ctx = await getSchedulingContext(userId);
  if (!ctx) {
    return {
      userId,
      imported: 0,
      updated: 0,
      removed: 0,
      chunksSynced: 0,
      error: 'User or organization not found',
    };
  }

  const google = await getGoogleAccessTokenForUser(ctx.userId);
  if (!google) {
    return {
      userId,
      imported: 0,
      updated: 0,
      removed: 0,
      chunksSynced: 0,
      error: 'Calendar not connected',
    };
  }

  const desired = getDesiredSyncWindow();
  const targetEnd =
    options?.viewEnd && options.viewEnd.getTime() > desired.end.getTime()
      ? options.viewEnd
      : desired.end;
  const targetRange: DateRange = { start: desired.start, end: targetEnd };

  const connection = await UserCalendarConnection.findOne({ userId: ctx.userId })
    .select('syncHorizonStart syncHorizonEnd')
    .lean();

  const chunks = connection?.syncHorizonEnd
    ? getSyncGapChunks(connection.syncHorizonEnd, targetRange)
    : getFullSyncChunks(targetRange);

  if (chunks.length === 0) {
    return {
      userId,
      imported: 0,
      updated: 0,
      removed: 0,
      chunksSynced: 0,
      syncHorizonEnd: connection?.syncHorizonEnd?.toISOString(),
    };
  }

  let imported = 0;
  let updated = 0;
  let removed = 0;

  for (const chunk of chunks) {
    const result = await syncMeetingsForUser(userId, chunk.start, chunk.end);
    if (result.error) {
      return { ...result, chunksSynced: 0 };
    }
    imported += result.imported;
    updated += result.updated;
    removed += result.removed;
  }

  const horizonStart = connection?.syncHorizonStart
    ? new Date(Math.min(connection.syncHorizonStart.getTime(), targetRange.start.getTime()))
    : targetRange.start;
  const lastChunk = chunks[chunks.length - 1];
  const horizonEnd = lastChunk.end;

  await UserCalendarConnection.updateOne(
    { userId: ctx.userId },
    {
      syncedAt: new Date(),
      syncHorizonStart: horizonStart,
      syncHorizonEnd: horizonEnd,
    }
  );

  await pruneMeetingsOutsideRetention(ctx.userId, ctx.organizationId);

  return {
    userId,
    imported,
    updated,
    removed,
    chunksSynced: chunks.length,
    syncHorizonEnd: horizonEnd.toISOString(),
  };
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
  rangeStart?: Date,
  rangeEnd?: Date
): Promise<{
  synced: number;
  failed: number;
  results: EnsureMeetingSyncHorizonResult[];
}> {
  await connectDB();
  const connections = await UserCalendarConnection.find({}).select('userId').lean();
  const results: EnsureMeetingSyncHorizonResult[] = [];

  for (const connection of connections) {
    const userId = connection.userId.toString();
    try {
      if (rangeStart && rangeEnd) {
        const legacy = await syncMeetingsForUser(userId, rangeStart, rangeEnd);
        results.push({ ...legacy, chunksSynced: 1 });
      } else {
        const result = await ensureMeetingSyncHorizon(userId);
        results.push(result);
      }
    } catch (error) {
      results.push({
        userId,
        imported: 0,
        updated: 0,
        removed: 0,
        chunksSynced: 0,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  const synced = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;
  return { synced, failed, results };
}
