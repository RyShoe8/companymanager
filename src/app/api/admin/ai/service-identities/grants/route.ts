import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';
import { issueServiceGrant, revokeServiceGrant, listServiceGrants } from '@/lib/ai/control/serviceIdentities';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    if (!auth.user.organizationId) throw new AiHttpError(403, 'An organization is required.');
    const query = new URL(request.url).searchParams;
    return aiResponse(await listServiceGrants(auth.user.organizationId, query.get('identityId') ?? '', query.get('before')));
  } catch (error) { return aiError(error); }
}
async function mutate(request: Request, revoke: boolean) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new AiHttpError(403, 'Invalid request origin.');
    if (!auth.user.organizationId) throw new AiHttpError(403, 'An organization is required.');
    const body = await readAiBody(request);
    await ensureAiIndexes();
    const actor = { userId: String(auth.user._id), organizationId: auth.user.organizationId };
    return aiResponse(await (revoke ? revokeServiceGrant(actor, body) : issueServiceGrant(actor, body)), revoke ? 200 : 201);
  } catch (error) { return aiError(error); }
}
export const POST = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);
