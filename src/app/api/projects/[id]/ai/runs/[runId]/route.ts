import { NextRequest } from 'next/server';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { getRunDetail, getRunEvents } from '@/lib/ai/control/runQueries';
import { cancelPlanning } from '@/lib/ai/control/planningQueue';
import { aiResponse, aiError, readAiBody } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; runId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { id, runId } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    if (request.nextUrl.searchParams.get('view') === 'events') return aiResponse(await getRunEvents(access, runId, request.nextUrl.searchParams.get('after')));
    return aiResponse({ ...await getRunDetail(access, runId), canManage: access.canManage });
  } catch (error) { return aiError(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const { id, runId } = await context.params;
    const access = await requireAiProject(request, id, true, true);
    if (!objectIdSchema.safeParse(runId).success) throw new AiHttpError(404, 'Run not found.');
    z.object({ action: z.literal('cancel') }).strict().parse(await readAiBody(request));
    return aiResponse(await cancelPlanning(access, runId));
  } catch (error) { return aiError(error); }
}
