import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getGoogleDriveAccessTokenForUser } from '@/lib/google/driveConnection';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const apiKey =
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || '';

    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured (NEXT_PUBLIC_GOOGLE_API_KEY)' },
        { status: 500 }
      );
    }

    const accessToken = await getGoogleDriveAccessTokenForUser(
      new Types.ObjectId(session.userId)
    );
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected', code: 'GOOGLE_DRIVE_NOT_CONNECTED' },
        { status: 403 }
      );
    }

    return NextResponse.json({ accessToken, clientId, apiKey });
  } catch (error) {
    console.error('Google picker token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
