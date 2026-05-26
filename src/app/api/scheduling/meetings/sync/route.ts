import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import {
  listMeetingsForUserInRange,
  syncMeetingsForUser,
} from '@/lib/scheduling/syncUserMeetings';

const SYNC_COOLDOWN_MS = 15_000;
const lastSyncByUser = new Map<string, number>();

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const now = Date.now();
    const last = lastSyncByUser.get(session.userId) || 0;
    if (now - last < SYNC_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Sync rate limited; try again shortly' }, { status: 429 });
    }
    lastSyncByUser.set(session.userId, now);

    await connectDB();

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const start = startParam ? new Date(startParam) : new Date();
    const end = endParam
      ? new Date(endParam)
      : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    const result = await syncMeetingsForUser(session.userId, start, end);
    if (result.error) {
      const status = result.error === 'Calendar not connected' ? 400 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    const meetings = await listMeetingsForUserInRange(session.userId, start, end);

    return NextResponse.json({
      imported: result.imported,
      updated: result.updated,
      removed: result.removed,
      meetings,
    });
  } catch (error) {
    console.error('Meetings sync error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
