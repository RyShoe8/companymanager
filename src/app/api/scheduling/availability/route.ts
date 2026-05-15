import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import UserAvailability from '@/lib/models/UserAvailability';
import { Types } from 'mongoose';

const DEFAULT_SLOTS = [0, 1, 2, 3, 4].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
}));

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const doc = await UserAvailability.findOne({
      userId: new Types.ObjectId(session.userId),
    }).lean();

    return NextResponse.json({
      timezone: doc?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      slots: doc?.slots?.length ? doc.slots : DEFAULT_SLOTS,
    });
  } catch (error) {
    console.error('Availability GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { timezone, slots } = body;
    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: 'slots must be an array' }, { status: 400 });
    }

    await connectDB();
    const doc = await UserAvailability.findOneAndUpdate(
      { userId: new Types.ObjectId(session.userId) },
      {
        userId: new Types.ObjectId(session.userId),
        timezone: typeof timezone === 'string' ? timezone : 'America/New_York',
        slots: slots.map((s: { dayOfWeek: number; startTime: string; endTime: string }) => ({
          dayOfWeek: Number(s.dayOfWeek),
          startTime: String(s.startTime).trim(),
          endTime: String(s.endTime).trim(),
        })),
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json(doc);
  } catch (error) {
    console.error('Availability PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
