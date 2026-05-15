import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const conn = await UserCalendarConnection.findOne({
      userId: new Types.ObjectId(session.userId),
      provider: 'google',
    }).lean();

    return NextResponse.json({
      connected: !!conn,
      calendarId: conn?.calendarId || 'primary',
      syncedAt: conn?.syncedAt || null,
    });
  } catch (error) {
    console.error('Calendar status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
