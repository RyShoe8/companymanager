import { NextRequest } from 'next/server';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { readIdeFile } from '@/lib/ai/ideCommitPush';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const path = request.nextUrl.searchParams.get('path');
    if (!path) throw new AiHttpError(400, 'path is required.');
    const result = await readIdeFile(access.organizationId, access.project._id, path);
    if (!result.ok) {
      return aiResponse({ ok: false, reason: result.reason, content: null, path: null, branch: null, sha: null });
    }
    return aiResponse({
      ok: true,
      reason: null,
      path: result.path,
      branch: result.branch,
      content: result.content,
      sha: result.sha,
    });
  } catch (error) {
    return aiError(error);
  }
}
