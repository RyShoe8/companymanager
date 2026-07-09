import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import {
  canStartMeetingSync,
  datesToSyncTimestamps,
  getMeetingSyncRetryMessage,
  recordMeetingSync,
  syncTimestampsToDates,
} from '@/lib/scheduling/meetingSyncRateLimit';
import {
  ensureMeetingSyncHorizon,
  listMeetingsForUserInRange,
  syncMeetingsForUser,
} from '@/lib/scheduling/syncUserMeetings';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const connection = await UserCalendarConnection.findOne({ userId: session.userId });
    const syncTimestamps = datesToSyncTimestamps(connection?.recentMeetingSyncAts);
    if (!canStartMeetingSync(syncTimestamps)) {
      return NextResponse.json(
        { error: getMeetingSyncRetryMessage(syncTimestamps) },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'ensureHorizon';
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (mode === 'range' && startParam && endParam) {
      const start = new Date(startParam);
      const end = new Date(endParam);
      const result = await syncMeetingsForUser(session.userId, start, end);
      if (result.error) {
        const status = result.error === 'Calendar not connected' ? 400 : 404;
        return NextResponse.json({ error: result.error }, { status });
      }
      const updatedTimestamps = recordMeetingSync(syncTimestamps);
      await UserCalendarConnection.updateOne(
        { userId: session.userId },
        {
          $set: {
            recentMeetingSyncAts: syncTimestampsToDates(updatedTimestamps),
            syncedAt: new Date(),
          },
        }
      );
      const meetings = await listMeetingsForUserInRange(session.userId, start, end);
      return NextResponse.json({
        imported: result.imported,
        updated: result.updated,
        removed: result.removed,
        meetings,
      });
    }

    const viewEnd = endParam ? new Date(endParam) : undefined;
    const result = await ensureMeetingSyncHorizon(session.userId, { viewEnd });
    if (result.error) {
      const status = result.error === 'Calendar not connected' ? 400 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    const updatedTimestamps = recordMeetingSync(syncTimestamps);
    await UserCalendarConnection.updateOne(
      { userId: session.userId },
      {
        $set: {
          recentMeetingSyncAts: syncTimestampsToDates(updatedTimestamps),
          syncedAt: new Date(),
        },
      }
    );

    const listStart = startParam ? new Date(startParam) : new Date();
    const listEnd = endParam ? new Date(endParam) : viewEnd ?? listStart;
    const meetings =
      startParam && endParam
        ? await listMeetingsForUserInRange(session.userId, listStart, listEnd)
        : undefined;

    return NextResponse.json({
      imported: result.imported,
      updated: result.updated,
      removed: result.removed,
      chunksSynced: result.chunksSynced,
      syncHorizonEnd: result.syncHorizonEnd,
      meetings,
    });
  } catch (error) {
    console.error('Meetings sync error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
