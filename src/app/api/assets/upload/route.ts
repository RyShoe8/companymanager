import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';
import { sanitizeString, isValidObjectId, validateImageFile } from '@/lib/utils/security';

// Dynamic import for sharp (optional - will fallback if not installed)
let sharp: any = null;
try {
  sharp = require('sharp');
} catch (e) {
  // Sharp not installed. Image compression will be skipped. Install with: npm install sharp
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assetType = formData.get('type') as string | null; // 'screenshot' or 'file'
    let name = formData.get('name') as string;
    let description = formData.get('description') as string | null;
    let category = formData.get('category') as string | null;
    let tags = formData.get('tags') as string | null;
    const linkedProjectId = formData.get('linkedProjectId') as string | null;
    const linkedProjectTaskIndex = formData.get('linkedProjectTaskIndex') as string | null;
    const linkedProjectTaskId = formData.get('linkedProjectTaskId') as string | null;
    const linkedContentItemId = formData.get('linkedContentItemId') as string | null;

    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
    ]);
    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Sanitize inputs
    name = sanitizeString(name, 200);
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    description = description ? sanitizeString(description, 2000) : null;
    category = category ? sanitizeString(category, 100) : null;

    // Parse tags
    let tagArray: string[] = [];
    if (tags) {
      tagArray = tags.split(',').map((t) => sanitizeString(t.trim(), 50)).filter((t) => t.length > 0);
    }

    // Validate ObjectIds if provided
    if (linkedProjectId && !isValidObjectId(linkedProjectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    if (linkedContentItemId && !isValidObjectId(linkedContentItemId)) {
      return NextResponse.json({ error: 'Invalid content item ID' }, { status: 400 });
    }

    // Prefer stable taskId; fall back to task index for legacy
    let linkedTaskId: string | undefined;
    let taskIndex: number | undefined;
    if (linkedProjectTaskId && isValidObjectId(linkedProjectTaskId)) {
      linkedTaskId = linkedProjectTaskId;
    } else if (linkedProjectTaskIndex !== null && linkedProjectTaskIndex !== undefined && linkedProjectTaskIndex !== '') {
      const parsed = parseInt(linkedProjectTaskIndex);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Invalid task index' }, { status: 400 });
      }
      taskIndex = parsed;
    }

    await connectDB();

    // Process image files (screenshots) with compression
    let fileUrl: string;
    let finalType = assetType || 'file';

    const isImage = file.type.startsWith('image/');
    if (isImage && !(await validateImageFile(file))) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }
    if (isImage && sharp) {
      try {
        // Compress and convert to WebP
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Use sharp with proper error handling
        const sharpInstance = sharp(buffer);
        const compressedBuffer = await sharpInstance
          .webp({ quality: 80, effort: 4 }) // Good balance between quality and file size
          .resize(1920, 1920, {
            fit: 'inside',
            withoutEnlargement: true
          }) // Max dimensions, maintain aspect ratio
          .toBuffer();

        const base64 = compressedBuffer.toString('base64');
        fileUrl = `data:image/webp;base64,${base64}`;

        if (assetType === 'screenshot' || !assetType) {
          finalType = 'screenshot';
        }
      } catch (error: any) {
        // Error compressing image
        // Fallback to original if compression fails
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        fileUrl = `data:${file.type};base64,${base64}`;
      }
    } else {
      // Non-image files or sharp not available - use original
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      fileUrl = `data:${file.type};base64,${base64}`;
    }

    const assetData: any = {
      name,
      type: finalType,
      fileUrl,
      description: description || undefined,
      category: category || undefined,
      tags: tagArray,
      userId: session.userId,
    };

    if (linkedProjectId) {
      assetData.linkedProjectId = linkedProjectId;
    }
    if (linkedTaskId) {
      assetData.linkedProjectTaskId = linkedTaskId;
    }
    if (taskIndex !== undefined) {
      assetData.linkedProjectTaskIndex = taskIndex;
    }
    if (linkedContentItemId) {
      assetData.linkedContentItemId = linkedContentItemId;
    }

    const asset = await Asset.create(assetData);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    // Upload asset error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
