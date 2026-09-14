import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { listIdeTree } from '@/lib/ai/ideCommitPush';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const path = request.nextUrl.searchParams.get('path') ?? '';
    const result = await listIdeTree(access.organizationId, access.project._id, path);
    if (!result.ok) {
      return aiResponse({ ok: false, reason: result.reason, entries: [], branch: null });
    }
    return aiResponse({
      ok: true,
      reason: null,
      branch: result.branch,
      entries: result.entries,
    });
  } catch (error) {
    return aiError(error);
  }
}
