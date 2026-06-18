import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth/middleware';
import { deleteSession } from '@/lib/auth/session';
import { enforceRateLimit, rateLimitKey } from '@/lib/security/rateLimit';
import { isValidEmail } from '@/lib/utils/security';
import { AccountDeletionError } from '@/lib/account/accountDeletionError';
import { deleteUserAccount } from '@/lib/account/deleteUserAccount';

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const limit = enforceRateLimit({
      key: rateLimitKey(request, `account-delete:${session.userId}`),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (limit) return limit;

    const body = await request.json();
    const confirmEmail =
      typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!confirmEmail || !isValidEmail(confirmEmail)) {
      return NextResponse.json({ error: 'Confirm your email address to delete your account.' }, { status: 400 });
    }

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user) {
      await deleteSession();
      return NextResponse.json({ success: true });
    }

    if (user.email.toLowerCase() !== confirmEmail) {
      return NextResponse.json({ error: 'Email confirmation does not match your account.' }, { status: 400 });
    }

    const hasPassword = !!user.password;
    if (hasPassword) {
      if (!password) {
        return NextResponse.json({ error: 'Password is required to delete your account.' }, { status: 400 });
      }
      const valid = await bcrypt.compare(password, user.password!);
      if (!valid) {
        return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
      }
    }

    await deleteUserAccount(session.userId);
    await deleteSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
