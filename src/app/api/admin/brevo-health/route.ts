import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { getBrevoHealthStatus } from '@/lib/services/email';

/**
 * GET /api/admin/brevo-health
 * System admin only — verifies Brevo env without exposing secrets.
 */
export async function GET() {
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

    const health = await getBrevoHealthStatus();
    return NextResponse.json(health);
  } catch (error) {
    console.error('Brevo health check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
