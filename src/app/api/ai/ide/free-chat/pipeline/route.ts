import { NextRequest } from 'next/server';
import { requireAttentionAccess } from '@/lib/ai/control/attention';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { mapModelProfilePublic, normalizeLegacyCredentialLabels } from '@/lib/ai/rolePipeline/profiles';
import { MODEL_PROVIDERS } from '@/lib/ai/rolePipeline/providerCatalog';
import { enrichCatalogModelsForApi, isFreeCredential } from '@/lib/ai/rolePipeline/modelMeta';
import { AiModelProfile } from '@/lib/models/AiRolePipeline';

export const dynamic = 'force-dynamic';

/** Company credentials + catalog for IDE Free Chat (no project pipelines). */
export async function GET(request: NextRequest) {
  try {
    await requireAttentionAccess(request);
    const profiles = await AiModelProfile.find({ enabled: true })
      .select('key label provider tier protocol endpoint model secretLast4 enabled updatedAt createdAt')
      .sort({ tier: 1, label: 1 })
      .limit(100)
      .maxTimeMS(3000)
      .lean();
    await normalizeLegacyCredentialLabels(profiles);
    return aiResponse({
      roles: [],
      pipelines: [],
      profiles: profiles.map(mapModelProfilePublic),
      catalog: MODEL_PROVIDERS.map((provider) => ({
        id: provider.id,
        label: provider.label,
        models: enrichCatalogModelsForApi(provider.models, {
          free: provider.id === 'custom' || isFreeCredential({ provider: provider.id, tier: provider.defaultTier }),
        }),
      })),
    });
  } catch (error) {
    return aiError(error);
  }
}
