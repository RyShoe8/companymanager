import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import InsightCategory from '@/lib/models/InsightCategory';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const order: { id: string; stageOrder: number }[] = body.order ?? [];

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 });
  }

  await Promise.all(
    order.map(({ id, stageOrder }) =>
      InsightCategory.updateOne({ _id: id }, { $set: { stageOrder } })
    )
  );

  return NextResponse.json({ ok: true });
}
