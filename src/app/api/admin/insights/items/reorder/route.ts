import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import InsightItem from '@/lib/models/InsightItem';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const order: { id: string; itemOrder: number; categoryId?: string }[] = body.order ?? [];

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 });
  }

  await Promise.all(
    order.map(({ id, itemOrder, categoryId }) => {
      const update: Record<string, unknown> = { itemOrder };
      if (categoryId) update.categoryId = categoryId;
      return InsightItem.updateOne({ _id: id }, { $set: update });
    })
  );

  return NextResponse.json({ ok: true });
}
