import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { runDataRetention } from '@/lib/cleanup/runDataRetention';

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

  try {
    await connectDB();
    const summary = await runDataRetention();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('[cron data-retention]', error);
    return NextResponse.json({ error: 'Cron retention failed' }, { status: 500 });
  }
}
