import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import FeedbackSubmission from '@/lib/models/FeedbackSubmission';
import { isValidObjectId } from '@/lib/utils/security';

/**
 * Update feedback status (system admin only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await connectDB();
    const adminUser = await User.findById(session.userId);
    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const status = body?.status;
    if (status !== 'new' && status !== 'done') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updated = await FeedbackSubmission.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated._id.toString(),
      status: updated.status,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
