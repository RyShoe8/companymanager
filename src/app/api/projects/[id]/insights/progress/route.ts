import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireProjectManagerOrAdmin } from '@/lib/insights/requireProjectManagerOrAdmin';
import { getInsightProgress } from '@/lib/insights/getInsightsForProject';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireProjectManagerOrAdmin(request, id);
  if (auth.error) return auth.error;

  await connectDB();
  const progress = await getInsightProgress(id);
  if (!progress) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json(progress);
}
