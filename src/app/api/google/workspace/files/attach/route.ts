import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  attachGoogleDriveFileAsset,
  parseGoogleAssetLinkFields,
} from '@/lib/google/workspaceOperations';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const googleFileId = typeof body.googleFileId === 'string' ? body.googleFileId.trim() : '';
    if (!googleFileId) {
      return NextResponse.json({ error: 'googleFileId is required' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    return attachGoogleDriveFileAsset(
      session,
      googleFileId,
      parseGoogleAssetLinkFields(body),
      name
    );
  } catch (error) {
    console.error('Google file attach error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
