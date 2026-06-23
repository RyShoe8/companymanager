import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  createGoogleSheetAsset,
  parseGoogleAssetLinkFields,
} from '@/lib/google/workspaceOperations';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    return createGoogleSheetAsset(session, name, parseGoogleAssetLinkFields(body));
  } catch (error) {
    console.error('Google sheet create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
