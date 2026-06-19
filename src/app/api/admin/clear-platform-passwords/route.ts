import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { clearStoredPlatformPasswords } from '@/lib/security/clearStoredPlatformPasswords';

/** POST /api/admin/clear-platform-passwords — one-time wipe of stored platform/email passwords. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: user.organizationId,
    });
    if (currentUserEmployee?.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only administrators can run data migrations' }, { status: 403 });
    }

    const result = await clearStoredPlatformPasswords();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to clear platform passwords:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
