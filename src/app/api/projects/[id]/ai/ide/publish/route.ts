import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { commitAndPushToDefaultBranch, ideCommitPushSchema } from '@/lib/ai/ideCommitPush';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** One human confirmation → Octokit commit + push to the bound repo default branch. */
export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, true, true);
    const input = ideCommitPushSchema.parse(await readAiBody(request));
    const result = await commitAndPushToDefaultBranch(
      access.organizationId,
      access.project._id,
      input
    );
    return aiResponse(result);
  } catch (error) {
    return aiError(error);
  }
}
