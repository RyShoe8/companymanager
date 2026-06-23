import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { disconnectGoogleDrive } from '@/lib/google/driveConnection';
import { Types } from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await disconnectGoogleDrive(new Types.ObjectId(session.userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Google workspace disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
