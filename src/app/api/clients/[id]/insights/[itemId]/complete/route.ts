import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import ClientInsightState from '@/lib/models/ClientInsightState';
import InsightItem from '@/lib/models/InsightItem';
import { requireClientManagerOrAdmin } from '@/lib/insights/requireClientManagerOrAdmin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: clientId, itemId } = await params;
  const auth = await requireClientManagerOrAdmin(request, clientId);
  if (auth.error) return auth.error;

  await connectDB();

  const item = await InsightItem.findOne({ _id: itemId, isActive: true });
  if (!item) {
    return NextResponse.json({ error: 'Insight item not found' }, { status: 404 });
  }

  await ClientInsightState.updateOne(
    { clientId: new Types.ObjectId(clientId), itemId: new Types.ObjectId(itemId) },
    {
      $set: { status: 'completed' },
      $unset: { dismissedServiceName: '' },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
