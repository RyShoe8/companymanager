import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';
import { sanitizeString, isValidObjectId } from '@/lib/utils/security';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    let name = formData.get('name') as string;
    let description = formData.get('description') as string | null;
    const linkedProjectId = formData.get('linkedProjectId') as string | null;
    const linkedProjectStageIndex = formData.get('linkedProjectStageIndex') as string | null;
    const linkedOperationId = formData.get('linkedOperationId') as string | null;

    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Sanitize inputs
    name = sanitizeString(name, 200);
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    description = description ? sanitizeString(description, 2000) : null;

    // Validate ObjectIds if provided
    if (linkedProjectId && !isValidObjectId(linkedProjectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    if (linkedOperationId && !isValidObjectId(linkedOperationId)) {
      return NextResponse.json({ error: 'Invalid operation ID' }, { status: 400 });
    }

    // Validate stage index
    let stageIndex: number | undefined;
    if (linkedProjectStageIndex !== null && linkedProjectStageIndex !== undefined && linkedProjectStageIndex !== '') {
      const parsed = parseInt(linkedProjectStageIndex);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Invalid stage index' }, { status: 400 });
      }
      stageIndex = parsed;
    }

    await connectDB();

    // Convert file to base64 for storage (in production, use cloud storage like S3, Cloudinary, etc.)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const fileUrl = `data:${file.type};base64,${base64}`;

    const assetData: any = {
      name,
      type: 'screenshot',
      fileUrl,
      description: description || undefined,
      userId: session.userId,
    };

    if (linkedProjectId) {
      assetData.linkedProjectId = linkedProjectId;
    }
    if (stageIndex !== undefined) {
      assetData.linkedProjectStageIndex = stageIndex;
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
