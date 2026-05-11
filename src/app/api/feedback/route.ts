import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import FeedbackSubmission from '@/lib/models/FeedbackSubmission';
import { isValidEmail, sanitizeString } from '@/lib/utils/security';

const VALID_TYPES = ['Bug', 'Feature Request', 'Other'] as const;

/**
 * Logged-in quick feedback (bug / feature) — persisted for admin review.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let { type, subject, message, pageUrl } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    type = typeof type === 'string' ? type : 'Other';
    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    message = sanitizeString(message, 5000);
    subject =
      typeof subject === 'string' && subject.trim()
        ? sanitizeString(subject, 200)
        : sanitizeString(message.split('\n')[0] || 'Feedback', 200);
    pageUrl = typeof pageUrl === 'string' ? sanitizeString(pageUrl, 2000) : '';

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const email = sanitizeString(user.email || session.email || '', 254);
    const name = sanitizeString(user.name || user.email || 'User', 100);
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid user email' }, { status: 400 });
    }

    await FeedbackSubmission.create({
      type: type as 'Bug' | 'Feature Request' | 'Other',
      subject,
      message,
      name,
      email,
      userId: user._id,
      organizationId: user.organizationId ? String(user.organizationId) : undefined,
      source: 'app',
      pageUrl: pageUrl || undefined,
      status: 'new',
    });

    return NextResponse.json({ message: 'Feedback submitted' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
