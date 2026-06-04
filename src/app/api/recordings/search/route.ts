import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { escapeRegex, sanitizeString } from '@/lib/utils/security';
import {
  getRecordingSessionContext,
  canAccessRecording,
} from '@/lib/recordings/recordingAccess';
import Recording from '@/lib/models/Recording';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const sanitizedQuery = sanitizeString(query, 100);
    if (!sanitizedQuery) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }

    await connectDB();
    const ctx = await getRecordingSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const escapedQuery = escapeRegex(sanitizedQuery);
    const regex = new RegExp(escapedQuery, 'i');

    const candidates = await Recording.find({
      organizationId: ctx.organizationId,
      $or: [{ title: regex }, { transcript: regex }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const results = [];
    for (const recording of candidates) {
      const allowed = await canAccessRecording(ctx, recording);
      if (allowed) results.push(recording);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Recording search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
