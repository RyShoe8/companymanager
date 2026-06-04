import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { estimateHoursWithOpenAI, type EstimateHoursKind } from '@/lib/ai/estimateHours';
import { enforceRateLimit, rateLimitKey } from '@/lib/security/rateLimit';

const MAX_TITLE_LEN = 500;
const MAX_DESC_LEN = 2000;

export async function POST(req: NextRequest) {
  const limit = enforceRateLimit({
    key: rateLimitKey(req, 'ai-estimate-hours'),
    limit: 20,
    windowMs: 60_000,
  });
  if (limit) return limit;

  const session = await requireAuth(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const kind = o.kind === 'content' ? 'content' : o.kind === 'task' ? 'task' : null;
  const title = typeof o.title === 'string' ? o.title.trim() : '';

  if (!kind) {
    return NextResponse.json({ error: 'kind must be task or content' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: 'title too long' }, { status: 400 });
  }

  const description = typeof o.description === 'string' ? o.description.trim().slice(0, MAX_DESC_LEN) : undefined;
  const channel = typeof o.channel === 'string' ? o.channel.trim().slice(0, 64) : undefined;
  const projectName = typeof o.projectName === 'string' ? o.projectName.trim().slice(0, 256) : undefined;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ estimatedHours: null });
  }

  try {
    const estimatedHours = await estimateHoursWithOpenAI(
      { kind: kind as EstimateHoursKind, title, description, channel, projectName },
      apiKey
    );
    return NextResponse.json({ estimatedHours });
  } catch (e) {
    console.error('[estimate-hours]', e);
    return NextResponse.json({ estimatedHours: null });
  }
}
