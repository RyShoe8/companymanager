import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { getGoogleAccessTokenForUser } from '@/lib/scheduling/calendarConnection';
import { extendMeetingSeries } from '@/lib/scheduling/extendMeetingSeries';
import type { ExtendUnit } from '@/lib/recurrence/recurrenceHorizons';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const seriesId =
      typeof body.seriesId === 'string'
        ? body.seriesId.trim()
        : typeof body.googleRecurringEventId === 'string'
          ? body.googleRecurringEventId.trim()
          : '';
    const unit = body.unit as ExtendUnit;

    if (!seriesId) {
      return NextResponse.json({ error: 'seriesId is required' }, { status: 400 });
    }
    if (unit !== 'week' && unit !== 'month' && unit !== 'year') {
      return NextResponse.json({ error: 'unit must be week, month, or year' }, { status: 400 });
    }

    const google = await getGoogleAccessTokenForUser(ctx.userId);
    if (!google) {
      return NextResponse.json(
        { error: 'Connect Google Calendar to extend recurring meetings.' },
        { status: 400 }
      );
    }

    await connectDB();

    const result = await extendMeetingSeries({
      ctx,
      accessToken: google.accessToken,
      calendarId: google.calendarId,
      googleRecurringEventId: seriesId,
      unit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Meeting extend-series error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
