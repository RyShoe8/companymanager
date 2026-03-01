import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    // Get user's organizationId
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const linkedProjectId = searchParams.get('linkedProjectId');
    const linkedProjectTaskIndex = searchParams.get('linkedProjectTaskIndex');
    const linkedProjectTaskId = searchParams.get('linkedProjectTaskId');
    const linkedOperationId = searchParams.get('linkedOperationId');

    const query: any = { userId: { $in: orgUserIds } };
    if (type) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    if (linkedProjectId) {
      query.linkedProjectId = linkedProjectId;
    }
    if (linkedProjectTaskId) {
      query.linkedProjectTaskId = linkedProjectTaskId;
    } else if (linkedProjectTaskIndex !== null && linkedProjectTaskIndex !== undefined) {
      query.linkedProjectTaskIndex = parseInt(linkedProjectTaskIndex);
    }
    if (linkedOperationId) {
      query.linkedOperationId = linkedOperationId;
    }

    const assets = await Asset.find(query).sort({ createdAt: -1 }).lean();

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
    const { name, type, url, fileUrl, textContent, description, category, tags, linkedProjectId, linkedProjectTaskIndex, linkedProjectTaskId, linkedOperationId, clientAccessible } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    await connectDB();

    // Prefer stable taskId; do not set taskIndex when taskId is provided
    const assetData: any = {
      name,
      type,
      url,
      fileUrl,
      textContent,
      description,
      category,
      tags: tags || [],
      linkedProjectId,
      linkedOperationId,
      clientAccessible: clientAccessible === true,
      userId: session.userId,
    };
    if (linkedProjectTaskId) {
      assetData.linkedProjectTaskId = linkedProjectTaskId;
    } else if (linkedProjectTaskIndex !== undefined && linkedProjectTaskIndex !== null) {
      assetData.linkedProjectTaskIndex = linkedProjectTaskIndex;
    }

    const asset = await Asset.create(assetData);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
