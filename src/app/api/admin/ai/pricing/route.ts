import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { fetchPricingCatalog } from '@/lib/ai/pricing/liveCatalog';

export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json(await fetchPricingCatalog(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not refresh the pricing source. Any displayed snapshot is outdated; verify prices with the provider.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

