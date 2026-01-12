import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './session';

export async function requireAuth(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

export async function getUserId(request: NextRequest): Promise<string | null> {
  const session = await getSession();
  return session?.userId || null;
}
