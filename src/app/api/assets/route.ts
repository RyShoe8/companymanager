import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const linkedProjectId = searchParams.get('linkedProjectId');
    const linkedOperationId = searchParams.get('linkedOperationId');

    const query: any = { userId: session.userId };
    if (type) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    if (linkedProjectId) {
      query.linkedProjectId = linkedProjectId;
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
    const { name, type, url, description, category, tags, linkedProjectId, linkedOperationId } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    await connectDB();

    const asset = await Asset.create({
      name,
      type,
      url,
      description,
      category,
      tags: tags || [],
      linkedProjectId,
      linkedOperationId,
      userId: session.userId,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Create asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
