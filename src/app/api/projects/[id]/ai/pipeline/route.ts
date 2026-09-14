import { NextRequest } from 'next/server';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { rolePipelineUpsertSchema } from '@/lib/ai/rolePipeline/schemas';
import { mapModelProfilePublic } from '@/lib/ai/rolePipeline/profiles';
import { AiModelProfile, AiRolePipeline } from '@/lib/models/AiRolePipeline';
import { aiEmployees } from '@/lib/ai/teamWorkspace';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
let indexes: Promise<unknown> | undefined;

function mapPipeline(row: {
  _id: { toString(): string };
  employee: string;
  planner: { modelProfileId: { toString(): string } };
  worker: { modelProfileId: { toString(): string } };
  reviewer: { modelProfileId: { toString(): string } };
  maxSubtasks: number;
  maxWorkerRetries: number;
  enabled: boolean;
  updatedAt?: Date;
}) {
  return {
    id: String(row._id),
    employee: row.employee,
    planner: { modelProfileId: String(row.planner.modelProfileId) },
    worker: { modelProfileId: String(row.worker.modelProfileId) },
    reviewer: { modelProfileId: String(row.reviewer.modelProfileId) },
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
        .select('key label tier protocol endpoint model secretLast4 enabled updatedAt createdAt')
        .sort({ tier: 1, label: 1 })
        .limit(100)
        .maxTimeMS(3000)
        .lean(),
    ]);
    return aiResponse({
      roles: aiEmployees,
      pipelines: pipelines.map(mapPipeline),
      profiles: profiles.map(mapModelProfilePublic),
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
      .select('_id tier')
      .maxTimeMS(3000)
      .lean();
    if (found.length !== 3) throw new AiHttpError(400, 'Each stage needs an enabled model profile.');

    const row = await AiRolePipeline.findOneAndUpdate(
      { organizationId: access.organizationId, employee: input.employee },
      {
        $set: {
          planner: { modelProfileId: input.planner.modelProfileId },
          worker: { modelProfileId: input.worker.modelProfileId },
          reviewer: { modelProfileId: input.reviewer.modelProfileId },
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
    return aiResponse({ pipeline: mapPipeline(row) });
  } catch (error) {
    return aiError(error);
  }
}
