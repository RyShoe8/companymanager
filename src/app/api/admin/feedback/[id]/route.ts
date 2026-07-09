import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
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
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    await connectDB();
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
