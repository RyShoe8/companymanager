import { NextRequest } from 'next/server';
import { z } from 'zod';
import { objectiveInputSchema, objectIdSchema, planDraftSchema } from '@nucleas/ai-contracts';
import { AiObjective, AiPlan, AiRun } from '@/lib/models/AiControl';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiResponse, aiError, readAiBody } from '@/lib/ai/control/http';
import { approvePlan, planDigest } from '@/lib/ai/control/plans';
import { cancelPlanning, queuePlanning } from '@/lib/ai/control/planningQueue';
import { planningAvailability } from '@/lib/ai/control/config';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';

export const dynamic = 'force-dynamic';
const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_objective'), requestId: z.string().uuid(), objective: objectiveInputSchema }).strict(),
  z.object({ action: z.literal('create_draft'), requestId: z.string().uuid(), objectiveId: objectIdSchema, draft: planDraftSchema }).strict(),
  z.object({ action: z.literal('approve_plan'), planId: objectIdSchema, digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal('plan_with_ai'), requestId: z.string().uuid(), objectiveId: objectIdSchema }).strict(),
  z.object({ action: z.literal('cancel_run'), runId: objectIdSchema }).strict(),
]);
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id);
    const scope = { organizationId: access.organizationId, projectId: access.project._id };
    if (request.nextUrl.searchParams.get('view') === 'runs') {
      const runs = await AiRun.find(scope).select('role status model createdAt completedAt planId failureCode inputTokens outputTokens latencyMs costMicros')
        .sort({ createdAt: -1 }).limit(25).lean();
      return aiResponse({ runs });
    }
    const [objectives, plans, runs] = await Promise.all([
      AiObjective.find(scope).sort({ createdAt: -1 }).limit(25).lean(),
      AiPlan.find(scope).sort({ createdAt: -1 }).limit(25).lean(),
      AiRun.find(scope).select('role status model createdAt completedAt planId failureCode inputTokens outputTokens latencyMs costMicros').sort({ createdAt: -1 }).limit(25).lean(),
    ]);
    const availability = await planningAvailability(access.organizationId, String(access.project._id));
    return aiResponse({ project: { id: String(access.project._id), name: access.project.name },
      canManage: access.canManage, objectives, plans, runs,
      capabilities: { inference: availability.enabled && access.canManage, execution: false },
      planning: availability,
      statusMessage: availability.enabled ? 'AI planning is queued on the server. Generated drafts require human approval; code execution is disabled.' :
        'Manual planning is available. Remote planning needs dispatcher, model, and budget configuration.',
    });
  } catch (error) { return aiError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    // Authenticate and scope before reading or acting on input.
    const access = await requireAiProject(request, (await context.params).id);
    const input = mutationSchema.parse(await readAiBody(request));
    await ensureAiIndexes();
    const scope = { organizationId: access.organizationId, projectId: access.project._id };
    if (input.action === 'plan_with_ai') return aiResponse(await queuePlanning(access, input.objectiveId, input.requestId), 202);
    if (input.action === 'cancel_run') return aiResponse(await cancelPlanning(access, input.runId));
    if (input.action === 'approve_plan') {
      return aiResponse(await approvePlan(access, input.planId, input.digest));
    }
    if (input.action === 'create_objective') {
      const existing = await AiObjective.findOne({ ...scope, requestId: input.requestId });
      if (existing) {
        if (String(existing.createdByUserId) !== access.userId || existing.title !== input.objective.title ||
          existing.outcome !== input.objective.outcome || existing.constraints !== input.objective.constraints ||
          JSON.stringify(existing.acceptanceCriteria) !== JSON.stringify(input.objective.acceptanceCriteria)) {
          throw new AiHttpError(409, 'Request key belongs to another objective.');
        }
        return aiResponse({ objective: existing });
      }
      const objective = await AiObjective.create({ ...scope, ...input.objective, requestId: input.requestId, createdByUserId: access.userId });
      return aiResponse({ objective }, 201);
    }
    const objective = await AiObjective.findOne({ ...scope, _id: input.objectiveId });
    if (!objective) throw new AiHttpError(404, 'Objective not found.');
    const existing = await AiPlan.findOne({ ...scope, requestId: input.requestId });
    if (existing) {
      if (String(existing.createdByUserId) !== access.userId || String(existing.objectiveId) !== input.objectiveId ||
        existing.digest !== planDigest(input.draft)) throw new AiHttpError(409, 'Request key belongs to another draft.');
      return aiResponse({ plan: existing });
    }
    const plan = await AiPlan.create({ ...scope, ...input.draft, objectiveId: objective._id,
      requestId: input.requestId, createdByUserId: access.userId,
      digest: planDigest(input.draft), projectUpdatedAt: access.project.updatedAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    return aiResponse({ plan }, 201);
  } catch (error) { return aiError(error); }
}
