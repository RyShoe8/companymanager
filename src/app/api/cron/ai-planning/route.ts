import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processPlanningQueue } from '../../../../../services/ai-runtime/planningWorker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await processPlanningQueue(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // No provider payloads, tokens, or project context in an operational error response.
    return NextResponse.json({ error: 'Planning worker unavailable. Check database transactions and runtime configuration.' }, { status: 503 });
  }
}
