import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const linkedProjectId = formData.get('linkedProjectId') as string;
    const linkedProjectStageIndex = formData.get('linkedProjectStageIndex') as string;
    const linkedOperationId = formData.get('linkedOperationId') as string;

    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 });
    }

    // Convert file to base64 for storage (in production, use cloud storage like S3, Cloudinary, etc.)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const fileUrl = `data:${file.type};base64,${base64}`;

    await connectDB();

    const assetData: any = {
      name,
      type: 'screenshot',
      fileUrl,
      description,
      userId: session.userId,
    };

    if (linkedProjectId) {
      assetData.linkedProjectId = linkedProjectId;
    }
    if (linkedProjectStageIndex !== null && linkedProjectStageIndex !== undefined && linkedProjectStageIndex !== '') {
      assetData.linkedProjectStageIndex = parseInt(linkedProjectStageIndex);
    }
    if (linkedOperationId) {
      assetData.linkedOperationId = linkedOperationId;
    }

    const asset = await Asset.create(assetData);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Upload asset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
