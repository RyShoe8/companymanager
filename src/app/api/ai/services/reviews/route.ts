import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import connectDB from '@/lib/db/mongodb';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { authenticateServiceCredential } from '@/lib/ai/control/serviceIdentities';
import { recordArtifactReview } from '@/lib/ai/control/artifactReviews';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';
export const dynamic = 'force-dynamic';
const inputSchema = z.object({ grantId: objectIdSchema, artifactId: objectIdSchema,
  grantRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), review: z.unknown() }).strict();
export async function POST(request: Request) {
  try {
    await connectDB();
    const authorization = request.headers.get('authorization');
    await authenticateServiceCredential(authorization);
    const input = inputSchema.parse(await readAiBody(request));
    await ensureAiIndexes();
    return aiResponse(await recordArtifactReview(authorization, input.grantId, input.grantRevision, input.artifactId, input.review), 201);
  } catch (error) { return aiError(error); }
}
