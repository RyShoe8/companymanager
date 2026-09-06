import { NextRequest } from 'next/server';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { requireAttentionAccess, listAttention, attentionFilterSchema, acknowledgeRun } from '@/lib/ai/control/attention';
import { requireAiProject } from '@/lib/ai/control/access';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const access = await requireAttentionAccess(request);
    const filter = attentionFilterSchema.parse(request.nextUrl.searchParams.get('filter') ?? 'all');
    return aiResponse(await listAttention(access, filter, request.nextUrl.searchParams.get('cursor')));
  } catch (error) { return aiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    // Authenticate before parsing input; project authorization also enforces same-origin writes.
    await requireAttentionAccess(request);
    const input = z.object({ projectId: objectIdSchema, runId: objectIdSchema, revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict().parse(await readAiBody(request));
    const access = await requireAiProject(request, input.projectId, false, true);
    await ensureAiIndexes();
    return aiResponse(await acknowledgeRun(access, input.runId, input.revision));
  } catch (error) { return aiError(error); }
}
