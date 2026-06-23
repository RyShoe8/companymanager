import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { loadPlatformCatalog } from '@/lib/platformCatalog/loadPlatformCatalog';
import { toPublicCatalog } from '@/lib/platformCatalog/buildSnapshot';

export async function GET(request: NextRequest) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const snapshot = await loadPlatformCatalog();
  const catalog = toPublicCatalog(snapshot);

  return NextResponse.json(catalog, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
