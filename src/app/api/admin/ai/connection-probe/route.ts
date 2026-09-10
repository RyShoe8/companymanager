import { z } from 'zod';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { readExecutionProbe, runExecutionProbe } from '@/lib/ai/control/executionProbe';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const kindSchema = z.enum(['chat', 'responses', 'chat-recheck', 'chat-detailed']);
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(); if (auth.error) return auth.error;
  try { return aiResponse(await readExecutionProbe(kindSchema.parse(new URL(request.url).searchParams.get('kind')))); }
  catch (error) { return aiError(error); }
}
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(); if (auth.error) return auth.error;
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new AiHttpError(403, 'Invalid request origin.');
    const body = z.object({ confirm: z.literal(true), kind: kindSchema }).strict().parse(await readAiBody(request));
    return aiResponse(await runExecutionProbe(String(auth.user._id), body.kind));
  } catch (error) { return aiError(error); }
}
