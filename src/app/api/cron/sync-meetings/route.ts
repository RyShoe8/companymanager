import { NextRequest, NextResponse } from 'next/server';
import { syncAllConnectedCalendars } from '@/lib/scheduling/syncUserMeetings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rangeStart = new Date();
  const rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const summary = await syncAllConnectedCalendars(rangeStart, rangeEnd);
    return NextResponse.json({
      ok: true,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      ...summary,
    });
  } catch (error) {
    console.error('[cron sync-meetings]', error);
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 });
  }
}
