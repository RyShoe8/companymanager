import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import ProjectInsightState from '@/lib/models/ProjectInsightState';
import InsightItem from '@/lib/models/InsightItem';
import { requireProjectManagerOrAdmin } from '@/lib/insights/requireProjectManagerOrAdmin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const auth = await requireProjectManagerOrAdmin(request, projectId);
  if (auth.error) return auth.error;

  await connectDB();

  const item = await InsightItem.findOne({ _id: itemId, isActive: true });
  if (!item) {
    return NextResponse.json({ error: 'Insight item not found' }, { status: 404 });
  }

  await ProjectInsightState.updateOne(
    { projectId: new Types.ObjectId(projectId), itemId: new Types.ObjectId(itemId) },
    {
      $set: { status: 'completed' },
      $unset: { dismissedServiceName: '' },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
