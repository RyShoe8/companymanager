import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import {
  listCalendarEvents,
  parseEventTimes,
} from '@/lib/scheduling/googleCalendar';
import { generateAgendaToken } from '@/lib/scheduling/tokenCrypto';
import { Types } from 'mongoose';

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

    await connectDB();

    const existingByGoogleId = new Map<string, { _id: Types.ObjectId }>();
    const existing = await Meeting.find({
      userId: ctx.userId,
      googleEventId: { $exists: true, $ne: null },
    }).select('googleEventId');
    for (const m of existing) {
      if (m.googleEventId) existingByGoogleId.set(m.googleEventId, { _id: m._id });
    }

    let imported = 0;
    let updated = 0;

    for (const ev of events) {
      if (!ev.id) continue;
      const times = parseEventTimes(ev);
      if (!times) continue;

      const payload = {
        title: ev.summary?.trim() || 'Untitled meeting',
        start: times.start,
        end: times.end,
        description: ev.description,
      };

      const found = existingByGoogleId.get(ev.id);
      if (found) {
        await Meeting.updateOne(
          { _id: found._id },
          { $set: payload }
        );
        updated++;
      } else {
        await Meeting.create({
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          ...payload,
          googleEventId: ev.id,
          agendaToken: generateAgendaToken(),
          linkedProjectIds: [],
          createdInNucleas: false,
        });
        imported++;
      }
    }

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
