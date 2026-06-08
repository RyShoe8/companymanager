import { NextRequest, NextResponse } from 'next/server';
import { processWorkspaceNotificationDigests } from '@/lib/workspace/workspaceNotifications';

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
    const summary = await processWorkspaceNotificationDigests();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error('[cron workspace-notifications]', error);
    return NextResponse.json({ error: 'Cron digest failed' }, { status: 500 });
  }
}
