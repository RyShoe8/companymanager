import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { validateAssetLinkExclusivity } from '@/lib/assets/validateAssetLinks';
import {
  applyAssetAccessFilter,
  assertCanLinkAsset,
  buildAssetAccessScope,
  getAssetSessionContext,
} from '@/lib/assets/assetAccess';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const linkedProjectId = searchParams.get('linkedProjectId');
    const linkedClientId = searchParams.get('linkedClientId');
    const linkedScope = searchParams.get('linkedScope');
    const linkedProjectTaskIndex = searchParams.get('linkedProjectTaskIndex');
    const linkedProjectTaskId = searchParams.get('linkedProjectTaskId');
    const linkedContentItemId = searchParams.get('linkedContentItemId');

    const query: Record<string, unknown> = { userId: { $in: orgUserIds } };
    if (type) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    if (linkedClientId && Types.ObjectId.isValid(linkedClientId)) {
      query.linkedClientId = new Types.ObjectId(linkedClientId);
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: [{ linkedProjectId: { $exists: false } }, { linkedProjectId: null }] },
        { $or: [{ linkedContentItemId: { $exists: false } }, { linkedContentItemId: null }] },
      ];
    }
    if (linkedProjectId && Types.ObjectId.isValid(linkedProjectId)) {
      query.linkedProjectId = new Types.ObjectId(linkedProjectId);
      const includeNestedLinks = linkedScope === 'all';
      if (!includeNestedLinks && !linkedProjectTaskId && linkedProjectTaskIndex == null) {
        query.$and = [
          { $or: [{ linkedProjectTaskId: { $exists: false } }, { linkedProjectTaskId: null }] },
          { $or: [{ linkedProjectTaskIndex: { $exists: false } }, { linkedProjectTaskIndex: null }] },
        ];
      }
    }
    if (linkedProjectTaskId && Types.ObjectId.isValid(linkedProjectTaskId)) {
      query.linkedProjectTaskId = new Types.ObjectId(linkedProjectTaskId);
    } else if (linkedProjectTaskIndex !== null && linkedProjectTaskIndex !== undefined) {
      query.linkedProjectTaskIndex = parseInt(linkedProjectTaskIndex);
    }
    if (linkedContentItemId && Types.ObjectId.isValid(linkedContentItemId)) {
      query.linkedContentItemId = new Types.ObjectId(linkedContentItemId);
    }

    const filteredQuery =
      scope != null ? applyAssetAccessFilter(query, ctx, scope) : query;

    const assets = await Asset.find(filteredQuery).sort({ createdAt: -1 }).lean();

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, type, url, fileUrl, textContent, description, category, tags, linkedProjectId, linkedClientId, linkedProjectTaskIndex, linkedProjectTaskId, linkedContentItemId, clientAccessible } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    const linkError = validateAssetLinkExclusivity({
      linkedClientId,
      linkedProjectId,
      linkedProjectTaskId,
      linkedProjectTaskIndex,
      linkedContentItemId,
    });
    if (linkError) {
      return NextResponse.json({ error: linkError }, { status: 400 });
    }

    await connectDB();

    const ctx = await getAssetSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const scope = ctx.isManagerOrAdmin ? null : await buildAssetAccessScope(ctx);
    const linkDenied = await assertCanLinkAsset(
      ctx,
      {
        linkedProjectId,
        linkedClientId,
        linkedProjectTaskId,
        linkedProjectTaskIndex,
        linkedContentItemId,
      },
      scope ?? undefined
    );
    if (linkDenied) return linkDenied;

    const assetData: Record<string, unknown> = {
      name,
      type,
      url,
      fileUrl,
      textContent,
      description,
      category,
      tags: tags || [],
      clientAccessible: clientAccessible === true,
      userId: session.userId,
    };
    if (linkedClientId && Types.ObjectId.isValid(linkedClientId)) {
      assetData.linkedClientId = new Types.ObjectId(linkedClientId);
    }
    if (linkedProjectId && Types.ObjectId.isValid(linkedProjectId)) {
      assetData.linkedProjectId = new Types.ObjectId(linkedProjectId);
    }
    if (linkedProjectTaskId && Types.ObjectId.isValid(linkedProjectTaskId)) {
      assetData.linkedProjectTaskId = new Types.ObjectId(linkedProjectTaskId);
    } else if (linkedProjectTaskIndex !== undefined && linkedProjectTaskIndex !== null) {
      assetData.linkedProjectTaskIndex = linkedProjectTaskIndex;
    }
    if (linkedContentItemId && Types.ObjectId.isValid(linkedContentItemId)) {
      assetData.linkedContentItemId = new Types.ObjectId(linkedContentItemId);
    }

    const asset = await Asset.create(assetData);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
