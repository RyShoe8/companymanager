import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { isGoogleDriveConnected } from '@/lib/google/driveConnection';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const connected = await isGoogleDriveConnected(new Types.ObjectId(session.userId));
    return NextResponse.json({ connected });
  } catch (error) {
    console.error('Google workspace status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
