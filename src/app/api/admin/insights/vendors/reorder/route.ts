import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import InsightVendor from '@/lib/models/InsightVendor';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const order: { id: string; displayOrder: number }[] = body.order ?? [];

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 });
  }

  await Promise.all(
    order.map(({ id, displayOrder }) =>
      InsightVendor.updateOne({ _id: id }, { $set: { displayOrder } })
    )
  );

  return NextResponse.json({ ok: true });
}
