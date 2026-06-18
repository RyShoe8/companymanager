import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { enforceRateLimit, rateLimitKey } from '@/lib/security/rateLimit';
import { isValidEmail } from '@/lib/utils/security';
import {
  generateEmailVerificationToken,
  getEmailVerificationExpiresAt,
  getEmailVerificationLink,
  hashEmailVerificationToken,
  isEmailVerificationPending,
} from '@/lib/auth/emailVerification';
import { sendVerificationEmail } from '@/lib/services/email';

export async function POST(request: NextRequest) {
  try {
    const limit = enforceRateLimit({
      key: rateLimitKey(request, 'auth-resend-verification'),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (limit) return limit;

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email });

    // Avoid account enumeration
    if (!user || !isEmailVerificationPending(user)) {
      return NextResponse.json({
        message: 'If that account needs verification, we sent a new email.',
      });
    }

    const token = generateEmailVerificationToken();
    user.emailVerificationTokenHash = hashEmailVerificationToken(token);
    user.emailVerificationExpires = getEmailVerificationExpiresAt();
    await user.save();

    await sendVerificationEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      verificationLink: getEmailVerificationLink(token),
    });

    return NextResponse.json({
      message: 'If that account needs verification, we sent a new email.',
    });
  } catch (error) {
    console.error('resend-verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
