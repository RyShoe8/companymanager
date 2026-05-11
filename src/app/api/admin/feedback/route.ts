import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import FeedbackSubmission from '@/lib/models/FeedbackSubmission';

/**
 * List feedback submissions (system admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const adminUser = await User.findById(session.userId);
    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 200);
    const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10) || 0, 0);

    const query: Record<string, unknown> = {};
    if (type && ['Bug', 'Feature Request', 'Other'].includes(type)) {
      query.type = type;
    }
    if (status && ['new', 'done'].includes(status)) {
      query.status = status;
    }

    const [items, total] = await Promise.all([
      FeedbackSubmission.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FeedbackSubmission.countDocuments(query),
    ]);

    const submissions = items.map((doc) => ({
      id: doc._id.toString(),
      type: doc.type,
      subject: doc.subject,
      message: doc.message,
      name: doc.name,
      email: doc.email,
      userId: doc.userId?.toString() ?? null,
      organizationId: doc.organizationId ?? null,
      source: doc.source,
      pageUrl: doc.pageUrl ?? null,
      status: doc.status,
      createdAt: doc.createdAt,
    }));

    return NextResponse.json({ submissions, total, skip, limit });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
