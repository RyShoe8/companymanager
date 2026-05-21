import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { listCalendarEvents } from '@/lib/scheduling/googleCalendar';
import { upsertMeetingsFromGoogleEvents } from '@/lib/scheduling/importGoogleMeetings';

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

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const google = await getGoogleAccessTokenForUser(ctx.userId);
    if (!google) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const start = startParam ? new Date(startParam) : new Date();
    const end = endParam
      ? new Date(endParam)
      : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

    const events = await listCalendarEvents(
      google.accessToken,
      google.calendarId,
      start.toISOString(),
      end.toISOString()
    );

    const { imported, updated } = await upsertMeetingsFromGoogleEvents(ctx, events, {
      createdInNucleas: false,
    });

    await UserCalendarConnection.updateOne(
      { userId: ctx.userId },
      { syncedAt: new Date() }
    );

    const meetings = await Meeting.find({
      userId: ctx.userId,
      start: { $lt: end },
      end: { $gt: start },
    })
      .sort({ start: 1 })
      .lean();

    return NextResponse.json({ imported, updated, meetings });
  } catch (error) {
    console.error('Meetings sync error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
