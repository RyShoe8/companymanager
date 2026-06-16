import { NextResponse } from 'next/server';
import { computePublicCallAvailableSlots } from '@/lib/onboarding/salesCallBooking';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await computePublicCallAvailableSlots();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ slots: result.slots });
}
