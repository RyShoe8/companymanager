import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const order: { id: string; displayOrder: number }[] = body.order ?? [];

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 });
  }

  await Promise.all(
    order.map(({ id, displayOrder }) =>
      PlatformOption.updateOne({ _id: id }, { $set: { displayOrder } })
    )
  );

  invalidatePlatformCatalogCache();
  return NextResponse.json({ ok: true });
}
