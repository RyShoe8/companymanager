import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { loadAvailableModelPricing } from '@/lib/ai/pricing/availablePricing.server';

export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await loadAvailableModelPricing(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load available providers and models. Verify the configured credentials and try again.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
