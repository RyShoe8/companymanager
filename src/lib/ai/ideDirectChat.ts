import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { GatewayError, invokeModel } from '@nucleas/ai-core/gateway';
import { digestValue } from '@nucleas/ai-core/planning';
import { getPipelineInferencePolicy } from '@/lib/ai/control/config';
import { reserveRunBudget, settleRunBudget } from '@/lib/ai/control/budgets';
import { decrementFreePoolRemaining } from '@/lib/ai/control/freePool';
import { DISPATCH_USAGE_ID, reserveDispatch } from '@/lib/ai/control/dispatchLimits';
import { aiTransaction } from '@/lib/ai/control/transaction';
import { classifyProbeFailure } from '@/lib/ai/probeDiagnostics';
import { gatewayFromModelProfile } from '@/lib/ai/rolePipeline/profiles';
import { AiBudget, AiDispatchLock, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import type { TeamChatTurn } from '@/lib/ai/teamChat';

const DIRECT_LOCK_MS = 60000;

function statusTurn(
  text: string,
  failureCategory: string,
  runId?: string,
  cost?: { costMicros?: number | null; reservedMicros?: number | null; noProviderFee?: boolean }
): TeamChatTurn {
  return {
    requestId: randomUUID(),
    role: 'status',
    text,
    failureCategory,
    ...(runId ? { runId } : {}),
    ...(cost?.costMicros !== undefined ? { costMicros: cost.costMicros } : {}),
    ...(cost?.reservedMicros !== undefined ? { reservedMicros: cost.reservedMicros } : {}),
    ...(cost?.noProviderFee !== undefined ? { noProviderFee: cost.noProviderFee } : {}),
  };
}

/**
 * Single-model IDE chat via a company credential (Direct mode).
 * Uses pipeline admission (not the platform shared bearer).
 */
export async function attemptDirectModelChat(input: {
  projectName: string;
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  userText: string;
  priorTurns: { role: 'user' | 'assistant' | 'status'; text: string }[];
  modelProfileId: string;
  model: string;
  ruleTexts?: string[];
  signal?: AbortSignal;
}): Promise<TeamChatTurn> {
  let gateway;
  let profile;
  try {
    ({ gateway, profile } = await gatewayFromModelProfile(input.modelProfileId, input.model));
  } catch (error) {
    if (error instanceof GatewayError) {
      return statusTurn('Direct model credential or model id is unavailable.', error.code);
    }
    return statusTurn('Direct model credential or model id is unavailable.', 'configuration');
  }

  const lockToken = randomUUID();
  let runId: Types.ObjectId;
  let policy: Awaited<ReturnType<typeof getPipelineInferencePolicy>>;

  try {
    const admitted = await aiTransaction(async (session) => {
      policy = await getPipelineInferencePolicy(input.organizationId, String(input.projectId), session);
      const now = new Date();
      const lock = await AiDispatchLock.findById(DISPATCH_USAGE_ID).session(session);
      if (lock && lock.expiresAt > now) throw new GatewayError('unavailable');
      await AiDispatchLock.updateOne(
        { _id: DISPATCH_USAGE_ID },
        { $set: { token: lockToken, expiresAt: new Date(now.getTime() + DIRECT_LOCK_MS) } },
        { upsert: true, session }
      );
      if (
        !(await reserveDispatch(
          {
            dailyRequestLimit: policy.dailyRequestLimit,
            minimumIntervalSeconds: policy.minimumIntervalSeconds,
          },
          now,
          session
        ))
      ) {
        await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: lockToken }).session(session);
        throw new GatewayError('rate_limit');
      }

      const [run] = await AiRun.create(
        [
          {
            organizationId: input.organizationId,
            projectId: input.projectId,
            role: 'architect',
            status: 'queued',
            createdByUserId: new Types.ObjectId(input.userId),
            inputDigest: digestValue(input.userText.slice(0, 6000)),
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
      return { runId: run._id, policy };
    });
    runId = admitted.runId;
    policy = admitted.policy;
  } catch (error) {
    await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: lockToken }).catch(() => undefined);
    if (error instanceof GatewayError) {
      return statusTurn('Direct chat could not be admitted.', error.code);
    }
    return statusTurn(
      'Direct chat needs processing enabled and a positive reservation within budget ceilings.',
      'unavailable'
    );
  }

  async function finish(args: {
    actualMicros: number | null;
    status: 'completed' | 'blocked';
    summary: string;
    failureCode?: string;
    result?: { inputTokens?: number | null; outputTokens?: number | null; latencyMs?: number | null };
  }) {
    await aiTransaction(async (session) => {
      await settleRunBudget(input.organizationId, runId, args.actualMicros, session);
      if (policy.noProviderFee && policy.reservationMicros > 0) {
        await decrementFreePoolRemaining(policy.reservationMicros, session);
      }
      const run = await AiRun.findOneAndUpdate(
        { _id: runId, organizationId: input.organizationId, projectId: input.projectId },
        {
          $set: {
            status: args.status,
            completedAt: new Date(),
            ...(args.failureCode ? { failureCode: args.failureCode } : {}),
            ...(args.result?.inputTokens != null ? { inputTokens: args.result.inputTokens } : {}),
            ...(args.result?.outputTokens != null ? { outputTokens: args.result.outputTokens } : {}),
            ...(args.result?.latencyMs != null ? { latencyMs: args.result.latencyMs } : {}),
            ...(args.actualMicros !== null ? { costMicros: args.actualMicros } : {}),
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
              type: `run.${args.status}`,
              summary: args.summary.slice(0, 2000),
            },
          ],
          { session }
        );
      }
    });
    await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: lockToken }).catch(() => undefined);
  }

  if (input.signal?.aborted) {
    await finish({
      actualMicros: policy.noProviderFee ? 0 : null,
      status: 'blocked',
      summary: 'Direct chat cancelled after admission.',
      failureCode: 'cancelled',
    }).catch(() => undefined);
    return statusTurn('The chat request was cancelled before completion.', 'cancelled', String(runId), {
      costMicros: policy.noProviderFee ? 0 : null,
      reservedMicros: policy.reservationMicros,
      noProviderFee: policy.noProviderFee,
    });
  }

  const history = input.priorTurns
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .slice(-8)
    .map((turn) => ({ role: turn.role as 'user' | 'assistant', content: turn.text.slice(0, 2000) }));
  const ruleBlock =
    input.ruleTexts && input.ruleTexts.length > 0
      ? ['Project task rules you must follow:', ...input.ruleTexts.map((rule, index) => `${index + 1}. ${rule}`)].join(
          '\n'
        )
      : null;
  const messages = [
    {
      role: 'system' as const,
      content: [
        `You are a helpful assistant on the Nucleas project "${input.projectName}".`,
        `You are running as model ${profile.model} via ${profile.label}.`,
        'Reply helpfully and briefly. Do not claim to have changed project data, run code, browsed the live web, or completed tasks outside this chat.',
        ...(ruleBlock ? [ruleBlock] : []),
      ].join(' '),
    },
    ...history,
    { role: 'user' as const, content: input.userText.slice(0, 6000) },
  ];

  try {
    const result = await invokeModel(
      gateway,
      {
        role: 'architect',
        messages,
        maxOutputTokens: Math.min(512, policy.maxOutputTokens),
      },
      { signal: input.signal }
    );
    const content = result.content.trim().slice(0, 6000);
    if (!content) {
      await finish({
        actualMicros: policy.noProviderFee ? 0 : null,
        status: 'blocked',
        summary: 'Direct model returned empty chat content.',
        failureCode: 'invalid_response',
        result,
      });
      return statusTurn(
        'The model returned an empty reply. No assistant content was stored.',
        'invalid_response',
        String(runId),
        {
          costMicros: policy.noProviderFee ? 0 : null,
          reservedMicros: policy.reservationMicros,
          noProviderFee: policy.noProviderFee,
        }
      );
    }
    const settled = policy.noProviderFee ? 0 : null;
    await finish({
      actualMicros: settled,
      status: 'completed',
      summary: 'Direct model chat reply stored.',
      result,
    });
    return {
      requestId: randomUUID(),
      role: 'assistant',
      text: content,
      runId: String(runId),
      costMicros: settled,
      reservedMicros: policy.reservationMicros,
      noProviderFee: policy.noProviderFee,
    };
  } catch (error) {
    const failureCode = error instanceof GatewayError ? error.code : classifyProbeFailure(error);
    await finish({
      actualMicros: policy.noProviderFee ? 0 : null,
      status: 'blocked',
      summary: 'Direct model chat failed after admission.',
      failureCode,
    }).catch(() => undefined);
    if (error instanceof GatewayError) {
      return statusTurn(
        error.code === 'cancelled'
          ? 'The chat request was cancelled before completion.'
          : 'The direct model call failed.',
        error.code,
        String(runId),
        {
          costMicros: policy.noProviderFee ? 0 : null,
          reservedMicros: policy.reservationMicros,
          noProviderFee: policy.noProviderFee,
        }
      );
    }
    return statusTurn('The direct model call failed.', failureCode, String(runId), {
      costMicros: policy.noProviderFee ? 0 : null,
      reservedMicros: policy.reservationMicros,
      noProviderFee: policy.noProviderFee,
    });
  }
}
