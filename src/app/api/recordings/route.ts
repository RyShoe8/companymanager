import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { Types } from 'mongoose';
import { put } from '@vercel/blob';
import connectDB from '@/lib/db/mongodb';
import Recording from '@/lib/models/Recording';
import { requireAuth } from '@/lib/auth/middleware';
import { sanitizeString, isValidObjectId } from '@/lib/utils/security';
import {
  assertProjectRecordingAccess,
  getRecordingSessionContext,
} from '@/lib/recordings/recordingAccess';
import { isTrustedRecordingUrl } from '@/lib/recordings/recordingUrlPolicy';
import { enforceRateLimit, rateLimitKey } from '@/lib/security/rateLimit';

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

async function saveLocalRecordingFile(
  subpath: string,
  file: File
): Promise<string> {
  const uploadsDir = join(process.cwd(), 'public', 'uploads', 'recordings');
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
  const filepath = join(uploadsDir, subpath);
  const dir = join(filepath, '..');
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));
  return `/uploads/recordings/${subpath}`;
}

async function storeRecordingFile(
  orgId: string,
  recordingId: string,
  kind: 'video' | 'audio',
  file: File
): Promise<string> {
  const ext = file.type.includes('mp4') ? 'mp4' : 'webm';
  const filename = `${recordingId}-${kind}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`recordings/${orgId}/${filename}`, file, {
      access: 'public',
      contentType: file.type || (kind === 'audio' ? 'audio/webm' : 'video/webm'),
    });
    return blob.url;
  }

  return saveLocalRecordingFile(`${orgId}/${filename}`, file);
}

function parseDuration(raw: FormData | Record<string, unknown>): number {
  const value =
    raw instanceof FormData
      ? raw.get('duration')
      : (raw as Record<string, unknown>).duration;
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseLinkFields(raw: FormData | Record<string, unknown>): {
  projectId?: string;
  taskId?: string;
  contentItemId?: string;
} {
  const get = (key: string): string | undefined => {
    const value =
      raw instanceof FormData ? raw.get(key) : (raw as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  return {
    projectId: get('projectId'),
    taskId: get('taskId'),
    contentItemId: get('contentItemId'),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const ctx = await getRecordingSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const taskId = searchParams.get('taskId');
    const contentItemId = searchParams.get('contentItemId');

    const query: Record<string, unknown> = {
      organizationId: ctx.organizationId,
    };

    if (projectId && isValidObjectId(projectId)) {
      query.projectId = new Types.ObjectId(projectId);
    }
    if (taskId && isValidObjectId(taskId)) {
      query.taskId = new Types.ObjectId(taskId);
    }
    if (contentItemId && isValidObjectId(contentItemId)) {
      query.contentItemId = new Types.ObjectId(contentItemId);
    }

    const recordings = await Recording.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json(recordings);
  } catch (error) {
    console.error('GET recordings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limit = enforceRateLimit({
      key: rateLimitKey(request, 'recordings-create'),
      limit: 12,
      windowMs: 60_000,
    });
    if (limit) return limit;

    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const ctx = await getRecordingSessionContext(session.userId);
    if (ctx instanceof NextResponse) return ctx;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const title = sanitizeString(body.title, 200);
      const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
      const audioUrl = typeof body.audioUrl === 'string' ? body.audioUrl.trim() : undefined;
      const duration = parseDuration(body);
      const links = parseLinkFields(body);

      if (!title || !videoUrl) {
        return NextResponse.json({ error: 'Title and videoUrl are required' }, { status: 400 });
      }
      const origin = new URL(request.url).origin;
      if (!isTrustedRecordingUrl(videoUrl, { requestOrigin: origin, allowRelativeUploads: true })) {
        return NextResponse.json({ error: 'videoUrl host is not allowed' }, { status: 400 });
      }
      if (
        audioUrl &&
        !isTrustedRecordingUrl(audioUrl, { requestOrigin: origin, allowRelativeUploads: true })
      ) {
        return NextResponse.json({ error: 'audioUrl host is not allowed' }, { status: 400 });
      }

      const projectError = await assertProjectRecordingAccess(ctx, links.projectId);
      if (projectError) return projectError;

      const recording = await Recording.create({
        title,
        userId: session.userId,
        organizationId: ctx.organizationId,
        projectId: links.projectId && isValidObjectId(links.projectId)
          ? new Types.ObjectId(links.projectId)
          : undefined,
        taskId: links.taskId && isValidObjectId(links.taskId)
          ? new Types.ObjectId(links.taskId)
          : undefined,
        contentItemId: links.contentItemId && isValidObjectId(links.contentItemId)
          ? new Types.ObjectId(links.contentItemId)
          : undefined,
        videoUrl,
        audioUrl: audioUrl || undefined,
        duration,
        status: 'processing',
      });

      return NextResponse.json({
        id: recording._id.toString(),
        videoUrl: recording.videoUrl,
        audioUrl: recording.audioUrl,
        status: recording.status,
      });
    }

    const formData = await request.formData();
    const video = formData.get('video') as File | null;
    const audio = formData.get('audio') as File | null;
    const title = sanitizeString(formData.get('title') as string, 200);
    const duration = parseDuration(formData);
    const links = parseLinkFields(formData);

    if (!video || !title) {
      return NextResponse.json({ error: 'Video file and title are required' }, { status: 400 });
    }

    if (!video.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Video file must be a video' }, { status: 400 });
    }
    if (video.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: 'Video file is too large' }, { status: 400 });
    }
    if (audio && audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file is too large' }, { status: 400 });
    }

    const projectError = await assertProjectRecordingAccess(ctx, links.projectId);
    if (projectError) return projectError;

    const draft = await Recording.create({
      title,
      userId: session.userId,
      organizationId: ctx.organizationId,
      projectId: links.projectId && isValidObjectId(links.projectId)
        ? new Types.ObjectId(links.projectId)
        : undefined,
      taskId: links.taskId && isValidObjectId(links.taskId)
        ? new Types.ObjectId(links.taskId)
        : undefined,
      contentItemId: links.contentItemId && isValidObjectId(links.contentItemId)
        ? new Types.ObjectId(links.contentItemId)
        : undefined,
      videoUrl: 'pending',
      duration,
      status: 'uploading',
    });

    const recordingId = draft._id.toString();
    const orgId = ctx.organizationId.toString();

    try {
      const videoUrl = await storeRecordingFile(orgId, recordingId, 'video', video);
      let audioUrl: string | undefined;
      if (audio && audio.size > 0) {
        audioUrl = await storeRecordingFile(orgId, recordingId, 'audio', audio);
      }

      draft.videoUrl = videoUrl;
      draft.audioUrl = audioUrl;
      draft.status = 'processing';
      await draft.save();

      return NextResponse.json({
        id: recordingId,
        videoUrl,
        audioUrl,
        status: draft.status,
      });
    } catch (uploadError) {
      draft.status = 'failed';
      draft.errorMessage = 'Failed to upload recording files.';
      await draft.save();
      throw uploadError;
    }
  } catch (error) {
    console.error('POST recordings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
