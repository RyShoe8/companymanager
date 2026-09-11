import { NextRequest } from 'next/server';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { publishAcceptedReview } from '@/lib/ai/control/githubPublishAction';
import { aiError, aiResponse } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; reviewId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id, reviewId } = await context.params;
    if (!objectIdSchema.safeParse(reviewId).success) throw new AiHttpError(404, 'Review not found.');
    const access = await requireAiProject(request, id, true, true);
    z.object({ id: objectIdSchema }).strict().parse({ id: reviewId });
    const result = await publishAcceptedReview(access, reviewId);
    if (result.status === 'blocked') {
      return aiResponse(
        {
          error: result.reason,
          status: result.status,
          pullRequestUrl: null,
          repository: result.repository,
        },
        result.reason?.includes('not been verified') || result.reason?.includes('Accept the exact')
          ? 409
          : 422
      );
    }
    return aiResponse({
      status: result.status,
      pullRequestUrl: result.pullRequestUrl,
      repository: result.repository,
    });
  } catch (error) {
    return aiError(error);
  }
}
