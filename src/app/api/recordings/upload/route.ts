import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import { getRecordingSessionContext } from '@/lib/recordings/recordingAccess';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const ctx = await getRecordingSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            'video/webm',
            'video/mp4',
            'audio/webm',
            'audio/ogg',
            'audio/mp4',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: session.userId,
            organizationId: ctx.organizationId.toString(),
          }),
        };
      },
      onUploadCompleted: async () => {
        // Recording doc is created after client upload completes via POST /api/recordings JSON.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Recording blob upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
}
