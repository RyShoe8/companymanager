import { NextRequest } from 'next/server';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { rolePipelineUpsertSchema } from '@/lib/ai/rolePipeline/schemas';
import { mapModelProfilePublic, normalizeLegacyCredentialLabels } from '@/lib/ai/rolePipeline/profiles';
import { isModelAllowedForProvider, MODEL_PROVIDERS } from '@/lib/ai/rolePipeline/providerCatalog';
import { enrichCatalogModelsForApi } from '@/lib/ai/rolePipeline/modelMeta';
import { AiModelProfile, AiRolePipeline } from '@/lib/models/AiRolePipeline';
import { aiEmployees } from '@/lib/ai/teamWorkspace';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
let indexes: Promise<unknown> | undefined;

type StageDoc = {
  modelProfileId: { toString(): string };
  model?: string | null;
};

function mapStage(
  stage: StageDoc,
  profilesById: Map<string, { model?: string | null }>
) {
  const profileId = String(stage.modelProfileId);
  const fallback = profilesById.get(profileId)?.model?.trim() ?? '';
  return {
    modelProfileId: profileId,
    model: (stage.model?.trim() || fallback).trim(),
  };
}

function mapPipeline(
  row: {
    _id: { toString(): string };
    employee: string;
    planner: StageDoc;
    worker: StageDoc;
    reviewer: StageDoc;
    maxSubtasks: number;
    maxWorkerRetries: number;
    enabled: boolean;
    updatedAt?: Date;
  },
  profilesById: Map<string, { model?: string | null }>
) {
  return {
    id: String(row._id),
    employee: row.employee,
    planner: mapStage(row.planner, profilesById),
    worker: mapStage(row.worker, profilesById),
    reviewer: mapStage(row.reviewer, profilesById),
    maxSubtasks: row.maxSubtasks,
    maxWorkerRetries: row.maxWorkerRetries,
    enabled: row.enabled,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const [pipelines, profiles] = await Promise.all([
      AiRolePipeline.find({ organizationId: access.organizationId })
        .sort({ employee: 1 })
        .limit(20)
        .maxTimeMS(3000)
        .lean(),
      AiModelProfile.find({ enabled: true })
        .select('key label provider tier protocol endpoint model secretLast4 enabled updatedAt createdAt')
        .sort({ tier: 1, label: 1 })
        .limit(100)
        .maxTimeMS(3000)
        .lean(),
    ]);
    await normalizeLegacyCredentialLabels(profiles);
    const profilesById = new Map(profiles.map((item) => [String(item._id), item]));
    return aiResponse({
      roles: aiEmployees,
      pipelines: pipelines.map((row) => mapPipeline(row, profilesById)),
      profiles: profiles.map(mapModelProfilePublic),
      catalog: MODEL_PROVIDERS.map((provider) => ({
        id: provider.id,
        label: provider.label,
        models: enrichCatalogModelsForApi(provider.models, { free: provider.id === 'custom' }),
      })),
      canManage: access.canManage,
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, true, true);
    const input = rolePipelineUpsertSchema.parse(await readAiBody(request));
    indexes ??= AiRolePipeline.createIndexes().catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;

    const ids = [input.planner.modelProfileId, input.worker.modelProfileId, input.reviewer.modelProfileId];
    const found = await AiModelProfile.find({ _id: { $in: ids }, enabled: true })
      .select('_id tier provider model')
      .maxTimeMS(3000)
      .lean();
    if (found.length !== new Set(ids).size) {
      throw new AiHttpError(400, 'Each stage needs an enabled company credential.');
    }
    const byId = new Map(found.map((item) => [String(item._id), item]));
    for (const stage of [input.planner, input.worker, input.reviewer]) {
      const credential = byId.get(stage.modelProfileId);
      if (!credential) throw new AiHttpError(400, 'Each stage needs an enabled company credential.');
      if (!isModelAllowedForProvider(credential.provider ?? 'custom', stage.model)) {
        throw new AiHttpError(400, `Model "${stage.model}" is not available for that company credential.`);
      }
    }

    const row = await AiRolePipeline.findOneAndUpdate(
      { organizationId: access.organizationId, employee: input.employee },
      {
        $set: {
          planner: { modelProfileId: input.planner.modelProfileId, model: input.planner.model },
          worker: { modelProfileId: input.worker.modelProfileId, model: input.worker.model },
          reviewer: { modelProfileId: input.reviewer.modelProfileId, model: input.reviewer.model },
          maxSubtasks: input.maxSubtasks,
          maxWorkerRetries: input.maxWorkerRetries,
          enabled: input.enabled,
          updatedByUserId: access.userId,
        },
        $setOnInsert: {
          organizationId: access.organizationId,
          employee: input.employee,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    if (!row) throw new AiHttpError(503, 'Unable to save role pipeline.');
    const profilesById = new Map(found.map((item) => [String(item._id), item]));
    return aiResponse({ pipeline: mapPipeline(row, profilesById) });
  } catch (error) {
    return aiError(error);
  }
}
