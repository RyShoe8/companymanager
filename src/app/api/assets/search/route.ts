import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { escapeRegex, sanitizeString } from '@/lib/utils/security';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Sanitize and limit query length
    const sanitizedQuery = sanitizeString(query, 100);
    if (sanitizedQuery.length === 0) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }

    // Escape regex special characters to prevent NoSQL injection
    const escapedQuery = escapeRegex(sanitizedQuery);

    await connectDB();

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    // Search in name, description, and tags with escaped query
    const assets = await Asset.find({
      userId: { $in: orgUserIds },
      $or: [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { description: { $regex: escapedQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(escapedQuery, 'i')] } },
      ],
    }).sort({ createdAt: -1 });

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Search assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
