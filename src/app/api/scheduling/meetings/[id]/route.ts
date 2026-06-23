import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import Meeting from '@/lib/models/Meeting';
import { getSchedulingContext } from '@/lib/scheduling/schedulingContext';
import { getAppBaseUrl } from '@/lib/utils/invitation';
import {
  deleteMeetingRecord,
  updateMeetingRecord,
  type MeetingUpdateScope,
} from '@/lib/scheduling/meetingCrud';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();

    await connectDB();
    const meeting = await Meeting.findOne({ _id: id, userId: ctx.userId });
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const baseUrl = getAppBaseUrl();
    const result = await updateMeetingRecord({
      meeting,
      userId: session.userId,
      organizationId: ctx.organizationId,
      body,
      baseUrl,
    });

    const saved = await Meeting.findById(meeting._id).lean();

    return NextResponse.json({
      ...(saved || result.meeting.toObject()),
      participantsUpdatedCount: result.participantsUpdatedCount,
      calendarsPatchedCount: result.calendarsPatchedCount,
      seriesUpdatedCount: result.seriesUpdatedCount,
      ...(result.meetingNotes ? { meetingNotes: result.meetingNotes } : {}),
    });
  } catch (error) {
    console.error('Meeting PATCH error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { error: 'Meeting update conflict. Please refresh and try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const ctx = await getSchedulingContext(session.userId);
    if (!ctx) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get('scope');
    const scope: MeetingUpdateScope =
      scopeParam === 'series' ? 'series' : 'instance';

    await connectDB();
    const meeting = await Meeting.findOne({ _id: id, userId: ctx.userId });
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (scope === 'series' && !meeting.googleRecurringEventId) {
      return NextResponse.json(
        { error: 'This meeting is not part of a recurring series.' },
        { status: 400 }
      );
    }

    const result = await deleteMeetingRecord({
      meeting,
      userId: session.userId,
      organizationId: ctx.organizationId,
      scope,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Meeting DELETE error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
