import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  uploadGoogleDriveFileAsset,
  parseGoogleAssetLinkFields,
} from '@/lib/google/workspaceOperations';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const form = await request.formData();
    const file = form.get('file');
    const nameRaw = form.get('name');
    const name =
      typeof nameRaw === 'string' && nameRaw.trim()
        ? nameRaw.trim()
        : file instanceof File
          ? file.name
          : '';

    if (!(file instanceof File) || !name) {
      return NextResponse.json({ error: 'file and name are required' }, { status: 400 });
    }

    const linkFields = parseGoogleAssetLinkFields({
      linkedProjectId: form.get('linkedProjectId'),
      linkedClientId: form.get('linkedClientId'),
      linkedProjectTaskId: form.get('linkedProjectTaskId'),
      linkedProjectTaskIndex:
        form.get('linkedProjectTaskIndex') != null
          ? Number(form.get('linkedProjectTaskIndex'))
          : undefined,
      linkedContentItemId: form.get('linkedContentItemId'),
      clientAccessible: form.get('clientAccessible') === 'true',
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    return uploadGoogleDriveFileAsset(
      session,
      name,
      file.type || 'application/octet-stream',
      buffer,
      linkFields
    );
  } catch (error) {
    console.error('Google file upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
