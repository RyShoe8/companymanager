import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset, { AssetType } from '@/lib/models/Asset';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { isValidObjectId, sanitizeString } from '@/lib/utils/security';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

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
    // Get asset error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    let { name, type, url, textContent, description, category, tags, linkedProjectId, linkedProjectTaskIndex, linkedProjectTaskId, clientAccessible } = body;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

    // Validate linked IDs if provided
    if (linkedProjectId && !isValidObjectId(linkedProjectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    if (linkedProjectTaskId && !isValidObjectId(linkedProjectTaskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 });
    }

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

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

    // Sanitize string inputs
    if (name !== undefined) asset.name = sanitizeString(name, 200);
    if (type !== undefined) {
      const validTypes: AssetType[] = ['spreadsheet', 'document', 'tool', 'folder', 'link', 'screenshot', 'file', 'text', 'other'];
      if (!validTypes.includes(type as AssetType)) {
        return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 });
      }
      asset.type = type as AssetType;
    }
    if (url !== undefined) asset.url = sanitizeString(url, 500);
    if (textContent !== undefined) asset.textContent = sanitizeString(textContent, 50000); // Allow up to 50KB of text
    if (description !== undefined) asset.description = sanitizeString(description, 2000);
    if (category !== undefined) asset.category = sanitizeString(category, 100);
    if (tags !== undefined) {
      // Validate tags is an array and sanitize each tag
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
      }
      asset.tags = tags.map((tag: any) => sanitizeString(String(tag), 50)).filter((tag: string) => tag.length > 0);
    }
    if (linkedProjectId !== undefined) asset.linkedProjectId = linkedProjectId;
    // Prefer stable taskId over taskIndex
    if (linkedProjectTaskId !== undefined && linkedProjectTaskId !== null && linkedProjectTaskId !== '') {
      asset.linkedProjectTaskId = linkedProjectTaskId;
      asset.linkedProjectTaskIndex = undefined;
    } else if (linkedProjectTaskIndex !== undefined && linkedProjectTaskIndex !== null && linkedProjectTaskIndex !== '') {
      asset.linkedProjectTaskIndex = typeof linkedProjectTaskIndex === 'number' ? linkedProjectTaskIndex : parseInt(linkedProjectTaskIndex);
      asset.linkedProjectTaskId = undefined;
    } else if (linkedProjectTaskId !== undefined || linkedProjectTaskIndex !== undefined) {
      // Explicitly clearing
      asset.linkedProjectTaskId = undefined;
      asset.linkedProjectTaskIndex = undefined;
    }
    if (clientAccessible !== undefined) asset.clientAccessible = !!clientAccessible;

    await asset.save();

    return NextResponse.json(asset);
  } catch (error) {
    // Update asset error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

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
    // Delete asset error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
