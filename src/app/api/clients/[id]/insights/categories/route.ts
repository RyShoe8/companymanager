import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requireClientManagerOrAdmin } from '@/lib/insights/requireClientManagerOrAdmin';
import { getInsightCategoriesWithStatusForOwner } from '@/lib/insights/getInsightsForOwner';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireClientManagerOrAdmin(request, id);
  if (auth.error) return auth.error;

  await connectDB();
  const categories = await getInsightCategoriesWithStatusForOwner('client', id);
  return NextResponse.json({ categories });
}
