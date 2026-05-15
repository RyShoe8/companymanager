import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import UserAvailability from '@/lib/models/UserAvailability';
import { normalizeAvailabilitySlots, sortSlotsMonFirst } from '@/lib/scheduling/availabilitySlots';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const doc = await UserAvailability.findOne({
      userId: new Types.ObjectId(session.userId),
    }).lean();

    const slots = sortSlotsMonFirst(normalizeAvailabilitySlots(doc?.slots));

    return NextResponse.json({
      timezone: doc?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      slots,
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

    const normalized = normalizeAvailabilitySlots(slots);

    await connectDB();
    const doc = await UserAvailability.findOneAndUpdate(
      { userId: new Types.ObjectId(session.userId) },
      {
        userId: new Types.ObjectId(session.userId),
        timezone: typeof timezone === 'string' ? timezone : 'America/New_York',
        slots: normalized.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          enabled: s.enabled !== false,
        })),
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({
      ...doc,
      slots: sortSlotsMonFirst(normalizeAvailabilitySlots(doc?.slots)),
    });
  } catch (error) {
    console.error('Availability PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
