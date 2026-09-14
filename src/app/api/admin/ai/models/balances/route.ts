import { aiError, aiResponse } from '@/lib/ai/control/http';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { loadCredentialBalances } from '@/lib/ai/rolePipeline/creditBalances';
import connectDB from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    await connectDB();
    const forceRefresh = new URL(request.url).searchParams.get('refresh') === '1';
    const payload = await loadCredentialBalances({ forceRefresh });
    return aiResponse(payload);
  } catch (error) {
    return aiError(error);
  }
}
