import { NextResponse } from 'next/server';
import { listOnboardingAvailability } from '@/lib/onboarding/requireOnboardingEligible';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listOnboardingAvailability();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ slots: result.slots });
}
