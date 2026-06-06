import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';
import { escapeRegex, sanitizeString } from '@/lib/utils/security';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import {
  applyAssetAccessFilter,
  buildAssetAccessScope,
  getAssetSessionContext,
} from '@/lib/assets/assetAccess';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const sanitizedQuery = sanitizeString(query, 100);
    if (sanitizedQuery.length === 0) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }

    const escapedQuery = escapeRegex(sanitizedQuery);

    await connectDB();

    const ctx = await getAssetSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const scope = ctx.isManagerOrAdmin ? null : await buildAssetAccessScope(ctx);

    const baseQuery: Record<string, unknown> = {
      userId: { $in: orgUserIds },
      $or: [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { description: { $regex: escapedQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(escapedQuery, 'i')] } },
      ],
    };

    const filteredQuery =
      scope != null ? applyAssetAccessFilter(baseQuery, ctx, scope) : baseQuery;

    const assets = await Asset.find(filteredQuery).sort({ createdAt: -1 }).lean();

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error searching assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
