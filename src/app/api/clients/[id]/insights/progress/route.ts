import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireClientManagerOrAdmin } from '@/lib/insights/requireClientManagerOrAdmin';
import { getInsightProgressForOwner } from '@/lib/insights/getInsightsForOwner';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireClientManagerOrAdmin(request, id);
  if (auth.error) return auth.error;

  await connectDB();
  const progress = await getInsightProgressForOwner('client', id);
  if (!progress) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  return NextResponse.json(progress);
}
