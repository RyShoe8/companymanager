import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import type { GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { GatewayError, invokeModel } from '@nucleas/ai-core/gateway';
import { digestValue } from '@nucleas/ai-core/planning';
import { getPipelineInferencePolicy } from '@/lib/ai/control/config';
import { reserveRunBudget, settleRunBudget } from '@/lib/ai/control/budgets';
import { decrementFreePoolRemaining } from '@/lib/ai/control/freePool';
import { DISPATCH_USAGE_ID } from '@/lib/ai/control/dispatchLimits';
import { aiTransaction } from '@/lib/ai/control/transaction';
import { AiBudget, AiDispatchLock, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import { gatewayFromModelProfile } from '@/lib/ai/rolePipeline/profiles';

const STAGE_LOCK_MS = 90000;

type StageAdmission = {
  runId: Types.ObjectId;
  lockToken: string;
  policy: Awaited<ReturnType<typeof getPipelineInferencePolicy>>;
  gateway: GatewayConfiguration;
  profile: { id: string; label: string; tier: string; model: string };
};

async function admitStageCall(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  modelProfileId: string;
  model: string;
  inputDigestSource: string;
}): Promise<StageAdmission> {
  const { gateway, profile } = await gatewayFromModelProfile(input.modelProfileId, input.model);
  const lockToken = randomUUID();
  return aiTransaction(async (session) => {
    const policy = await getPipelineInferencePolicy(input.organizationId, String(input.projectId), session);
    const now = new Date();
    const lock = await AiDispatchLock.findById(DISPATCH_USAGE_ID).session(session);
    if (lock && lock.expiresAt > now) throw new GatewayError('unavailable');
    await AiDispatchLock.updateOne(
      { _id: DISPATCH_USAGE_ID },
      { $set: { token: lockToken, expiresAt: new Date(now.getTime() + STAGE_LOCK_MS) } },
      { upsert: true, session }
    );
    // Company profile stages use the org's provider; do not consume shared remote spacing counters.

    const [run] = await AiRun.create(
      [
        {
          organizationId: input.organizationId,
          projectId: input.projectId,
          role: 'architect',
          status: 'queued',
          createdByUserId: new Types.ObjectId(input.userId),
          inputDigest: digestValue(input.inputDigestSource.slice(0, 6000)),
          policyDigest: policy.digest,
          model: gateway.model,
        },
      ],
      { session }
    );

    const period = now.toISOString().slice(0, 7);
    const budgetIds: Types.ObjectId[] = [];
    for (const [scopeKey, limitMicros] of [
      ['organization', policy.organizationLimitMicros],
      [`project:${String(input.projectId)}`, policy.projectLimitMicros],
    ] as const) {
      const budget = await AiBudget.findOneAndUpdate(
        { organizationId: input.organizationId, scopeKey, period },
        { $set: { limitMicros }, $setOnInsert: { spentMicros: 0, reservedMicros: 0 } },
        { session, upsert: true, new: true, runValidators: true }
      );
      budgetIds.push(budget._id);
    }
    await reserveRunBudget(input.organizationId, run._id, budgetIds, policy.reservationMicros, session);
    await AiRun.updateOne(
      { _id: run._id },
      { $set: { status: 'running', startedAt: now }, $inc: { revision: 1 } },
      { session }
    );
    await AiRunEvent.create(
      [
        {
          organizationId: input.organizationId,
          projectId: input.projectId,
          runId: run._id,
          sequence: 1,
          type: 'run.running',
          summary: `Role pipeline stage admitted for ${profile.label}.`,
        },
      ],
      { session }
    );
    return { runId: run._id, lockToken, policy, gateway, profile };
  });
}

async function finishStageCall(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  runId: Types.ObjectId;
  lockToken: string;
  actualMicros: number | null;
  status: 'completed' | 'blocked';
  summary: string;
  failureCode?: string;
  noProviderFee?: boolean;
  reservationMicros?: number;
  result?: {
    model?: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number | null;
  };
}) {
  try {
    await aiTransaction(async (session) => {
      await settleRunBudget(input.organizationId, input.runId, input.actualMicros, session);
      if (input.noProviderFee && (input.reservationMicros ?? 0) > 0) {
        await decrementFreePoolRemaining(input.reservationMicros!, session);
      }
      const run = await AiRun.findOneAndUpdate(
        { _id: input.runId, organizationId: input.organizationId, projectId: input.projectId },
        {
          $set: {
            status: input.status,
            completedAt: new Date(),
            summary: input.summary.slice(0, 2000),
            ...(input.failureCode ? { failureCode: input.failureCode } : {}),
            ...(input.result?.model ? { model: input.result.model } : {}),
            ...(input.result?.inputTokens != null ? { inputTokens: input.result.inputTokens } : {}),
            ...(input.result?.outputTokens != null ? { outputTokens: input.result.outputTokens } : {}),
            ...(input.result?.latencyMs != null ? { latencyMs: input.result.latencyMs } : {}),
            ...(input.actualMicros !== null ? { costMicros: input.actualMicros } : {}),
          },
          $inc: { revision: 1 },
        },
        { session, new: true }
      );
      if (run) {
        await AiRunEvent.create(
          [
            {
              organizationId: input.organizationId,
              projectId: input.projectId,
              runId: run._id,
              sequence: run.revision,
              type: `run.${input.status}`,
              summary: input.summary.slice(0, 2000),
            },
          ],
          { session }
        );
      }
    });
  } finally {
    await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: input.lockToken }).catch(() => undefined);
  }
}

/** One governed model call using a UI-managed model profile. */
export async function invokeProfileStage(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  modelProfileId: string;
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  signal?: AbortSignal;
}): Promise<{
  content: string;
  costMicros: number | null;
  reservedMicros: number;
  noProviderFee: boolean;
  aiRunId: string;
  profile: { id: string; label: string; tier: string; model: string };
}> {
  const admitted = await admitStageCall({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    modelProfileId: input.modelProfileId,
    model: input.model,
    inputDigestSource: input.messages.map((item) => item.content).join('\n'),
  });

  try {
    if (input.signal?.aborted) throw new GatewayError('cancelled');
    const result = await invokeModel(
      admitted.gateway,
      {
        role: 'architect',
        messages: input.messages,
        maxOutputTokens: Math.min(1024, admitted.policy.maxOutputTokens),
      },
      { signal: input.signal }
    );
    const content = result.content.trim();
    if (!content) {
      await finishStageCall({
        organizationId: input.organizationId,
        projectId: input.projectId,
        runId: admitted.runId,
        lockToken: admitted.lockToken,
        actualMicros: admitted.policy.noProviderFee ? 0 : null,
        status: 'blocked',
        summary: 'Stage model returned empty content.',
        failureCode: 'invalid_response',
        noProviderFee: admitted.policy.noProviderFee,
        reservationMicros: admitted.policy.reservationMicros,
        result,
      });
      throw new GatewayError('invalid_response');
    }
    const settled = admitted.policy.noProviderFee ? 0 : null;
    await finishStageCall({
      organizationId: input.organizationId,
      projectId: input.projectId,
      runId: admitted.runId,
      lockToken: admitted.lockToken,
      actualMicros: settled,
      status: 'completed',
      summary: 'Role pipeline stage completed.',
      noProviderFee: admitted.policy.noProviderFee,
      reservationMicros: admitted.policy.reservationMicros,
      result,
    });
    return {
      content,
      costMicros: settled,
      reservedMicros: admitted.policy.reservationMicros,
      noProviderFee: admitted.policy.noProviderFee,
      aiRunId: String(admitted.runId),
      profile: admitted.profile,
    };
  } catch (error) {
    const code = error instanceof GatewayError ? error.code : 'unavailable';
    await finishStageCall({
      organizationId: input.organizationId,
      projectId: input.projectId,
      runId: admitted.runId,
      lockToken: admitted.lockToken,
      actualMicros: admitted.policy.noProviderFee ? 0 : null,
      status: 'blocked',
      summary: 'Role pipeline stage failed.',
      failureCode: code,
      noProviderFee: admitted.policy.noProviderFee,
      reservationMicros: admitted.policy.reservationMicros,
    }).catch(() => undefined);
    throw error;
  }
}
