import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';

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
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const linkedProjectId = searchParams.get('linkedProjectId');
    const linkedProjectStageIndex = searchParams.get('linkedProjectStageIndex');
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
    if (linkedProjectStageIndex !== null && linkedProjectStageIndex !== undefined) {
      query.linkedProjectStageIndex = parseInt(linkedProjectStageIndex);
    }
    if (linkedOperationId) {
      query.linkedOperationId = linkedOperationId;
    }

    const assets = await Asset.find(query).sort({ createdAt: -1 });

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Get assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, type, url, fileUrl, description, category, tags, linkedProjectId, linkedProjectStageIndex, linkedOperationId } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    await connectDB();

    const asset = await Asset.create({
      name,
      type,
      url,
      fileUrl,
      description,
      category,
      tags: tags || [],
      linkedProjectId,
      linkedProjectStageIndex,
      linkedOperationId,
      userId: session.userId,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Create asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
