import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import UserCalendarConnection from '@/lib/models/UserCalendarConnection';
import { Types } from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    await UserCalendarConnection.deleteOne({
      userId: new Types.ObjectId(session.userId),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Calendar disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
