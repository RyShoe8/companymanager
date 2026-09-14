import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { decryptModelSecret } from '@/lib/ai/modelSecrets';
import { discoverOpenAiCompatibleModels } from '@/lib/ai/rolePipeline/discoverModels';
import { buildModelMetaView, isFreeCredential } from '@/lib/ai/rolePipeline/modelMeta';
import { AiModelProfile } from '@/lib/models/AiRolePipeline';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

/** List models from a company credential’s OpenAI-compatible host (custom / self-hosted). */
export async function GET(request: NextRequest, context: Context) {
  try {
    await requireAiProject(request, (await context.params).id, false, true);
    const profileId = request.nextUrl.searchParams.get('profileId')?.trim() ?? '';
    if (!Types.ObjectId.isValid(profileId)) {
      throw new AiHttpError(400, 'Provide a valid company credential id.');
    }
    const row = await AiModelProfile.findById(profileId)
      .select('provider tier endpoint secretCiphertext enabled')
      .maxTimeMS(3000)
      .lean();
    if (!row || !row.enabled) throw new AiHttpError(404, 'Company credential not found.');

    let bearerToken: string;
    try {
      bearerToken = decryptModelSecret(row.secretCiphertext);
    } catch {
      throw new AiHttpError(503, 'Unable to decrypt this company credential.');
    }

    const discovered = await discoverOpenAiCompatibleModels({
      endpoint: row.endpoint,
      bearerToken,
    });
    const free = isFreeCredential({ provider: row.provider, tier: row.tier });
    return aiResponse({
      profileId,
      provider: row.provider ?? 'custom',
      models: discovered.models.map((model) =>
        buildModelMetaView({
          id: model.id,
          label: model.label,
          bestAt: model.bestAt,
          strengths: model.strengths,
          contextTokens: model.contextTokens,
          flagship: model.flagship,
          free,
        })
      ),
      error: discovered.error,
    });
  } catch (error) {
    return aiError(error);
  }
}
