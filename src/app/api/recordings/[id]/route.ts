import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import {
  findAccessibleRecording,
  getRecordingSessionContext,
} from '@/lib/recordings/recordingAccess';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const ctx = await getRecordingSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const recording = await findAccessibleRecording(ctx, id);
    if (recording instanceof NextResponse) return recording;

    return NextResponse.json(recording);
  } catch (error) {
    console.error('GET recording error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
