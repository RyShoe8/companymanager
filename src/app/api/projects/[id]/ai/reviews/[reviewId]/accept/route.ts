import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { acceptStoredArtifact } from '@/lib/ai/control/artifactReviews';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; reviewId: string }> }) {
  try {
    const { id, reviewId } = await context.params;
    const access = await requireAiProject(request, id, true, true);
    await ensureAiIndexes();
    return aiResponse(await acceptStoredArtifact(access, reviewId));
  } catch (error) { return aiError(error); }
}
