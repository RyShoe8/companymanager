import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const asset = await Asset.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Get asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, type, url, description, category, tags, linkedProjectId, linkedOperationId } = body;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const asset = await Asset.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (name !== undefined) asset.name = name;
    if (type !== undefined) asset.type = type;
    if (url !== undefined) asset.url = url;
    if (description !== undefined) asset.description = description;
    if (category !== undefined) asset.category = category;
    if (tags !== undefined) asset.tags = tags;
    if (linkedProjectId !== undefined) asset.linkedProjectId = linkedProjectId;
    if (linkedOperationId !== undefined) asset.linkedOperationId = linkedOperationId;

    await asset.save();

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Update asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const asset = await Asset.findOneAndDelete({ _id: id, userId: { $in: orgUserIds } });
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
