import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    await connectDB();

    // Search in name, description, and tags
    const assets = await Asset.find({
      userId: session.userId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } },
      ],
    }).sort({ createdAt: -1 });

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Search assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
