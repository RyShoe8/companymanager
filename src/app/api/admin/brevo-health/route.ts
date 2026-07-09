import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { getBrevoHealthStatus } from '@/lib/services/email';

/**
 * GET /api/admin/brevo-health
 * System admin only — verifies Brevo env without exposing secrets.
 */
export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const health = await getBrevoHealthStatus();
    return NextResponse.json(health);
  } catch (error) {
    console.error('Brevo health check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
