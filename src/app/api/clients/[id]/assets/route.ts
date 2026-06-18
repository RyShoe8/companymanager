import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import Project from '@/lib/models/Project';
import Asset from '@/lib/models/Asset';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { aggregateClientAssets, isProjectLevelAsset } from '@/lib/clients/aggregateClientOperations';
import {
  applyAssetAccessFilter,
  buildAssetAccessScope,
  getAssetSessionContext,
} from '@/lib/assets/assetAccess';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const client = await Client.findOne({ _id: id, organizationId: user.organizationId }).lean();
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'client';

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const ctx = await getAssetSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;
    const accessScope = ctx.isManagerOrAdmin ? null : await buildAssetAccessScope(ctx);

    if (scope === 'client') {
      const query: Record<string, unknown> = {
        linkedClientId: new Types.ObjectId(id),
        userId: { $in: orgUserIds },
      };
      const filteredQuery =
        accessScope != null ? applyAssetAccessFilter(query, ctx, accessScope) : query;
      const assets = await Asset.find(filteredQuery).sort({ createdAt: -1 }).lean();
      return NextResponse.json(
        assets.map((a) => ({ ...a, source: { type: 'client' } }))
      );
    }

    const clientAssetsQuery: Record<string, unknown> = {
      linkedClientId: new Types.ObjectId(id),
      userId: { $in: orgUserIds },
    };
    const filteredClientQuery =
      accessScope != null ? applyAssetAccessFilter(clientAssetsQuery, ctx, accessScope) : clientAssetsQuery;
    const clientAssets = await Asset.find(filteredClientQuery).sort({ createdAt: -1 }).lean();

    const linkedProjects = await Project.find({
      clientId: id,
      userId: { $in: orgUserIds },
    })
      .select('_id name')
      .lean();

    const projectIds = linkedProjects.map((p) => p._id);
    const projectNameById = new Map(linkedProjects.map((p) => [String(p._id), p.name]));

    let projectAssets: Array<Record<string, unknown>> = [];
    if (projectIds.length > 0) {
      const projectQuery: Record<string, unknown> = {
        linkedProjectId: { $in: projectIds },
        userId: { $in: orgUserIds },
        $and: [
          { $or: [{ linkedProjectTaskId: { $exists: false } }, { linkedProjectTaskId: null }] },
          { $or: [{ linkedProjectTaskIndex: { $exists: false } }, { linkedProjectTaskIndex: null }] },
          { $or: [{ linkedContentItemId: { $exists: false } }, { linkedContentItemId: null }] },
        ],
      };
      const filteredProjectQuery =
        accessScope != null ? applyAssetAccessFilter(projectQuery, ctx, accessScope) : projectQuery;
      const raw = await Asset.find(filteredProjectQuery).sort({ createdAt: -1 }).lean();
      projectAssets = raw
        .filter((a) => isProjectLevelAsset(a))
        .map((a) => ({
          ...a,
          projectId: String(a.linkedProjectId),
          projectName: projectNameById.get(String(a.linkedProjectId)) ?? 'Project',
        }));
    }

    const merged = aggregateClientAssets(
      clientAssets as unknown as Parameters<typeof aggregateClientAssets>[0],
      projectAssets as unknown as Parameters<typeof aggregateClientAssets>[1]
    );

    return NextResponse.json(merged);
  } catch (error) {
    console.error('Failed to get client assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
