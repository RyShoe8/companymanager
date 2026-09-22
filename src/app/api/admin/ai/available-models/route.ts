import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { readPlatformSettings } from '@/lib/ai/control/settings';
import { discoverOpenAiCompatibleModels } from '@/lib/ai/rolePipeline/discoverModels';
import { AiHttpError } from '@/lib/ai/control/access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;
  try {
    const bearerToken = process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN?.trim();
    if (!bearerToken) throw new AiHttpError(409, 'Configure the remote bearer token before listing models.');
    const { value } = await readPlatformSettings();
    const result = await discoverOpenAiCompatibleModels({ endpoint: value.endpoint, bearerToken });
    if (result.error) throw new AiHttpError(502, result.error);
    return aiResponse({ models: result.models });
  } catch (error) {
    return aiError(error);
  }
}
