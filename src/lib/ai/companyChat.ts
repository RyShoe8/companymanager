import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { GatewayError, invokeModel, usesMaxCompletionTokens } from '@nucleas/ai-core/gateway';
import { digestValue } from '@nucleas/ai-core/planning';
import { getPipelineInferencePolicy } from '@/lib/ai/control/config';
import { reserveRunBudget, settleRunBudget } from '@/lib/ai/control/budgets';
import { decrementFreePoolRemaining } from '@/lib/ai/control/freePool';
import { DISPATCH_USAGE_ID } from '@/lib/ai/control/dispatchLimits';
import { aiTransaction } from '@/lib/ai/control/transaction';
import { classifyProbeFailure } from '@/lib/ai/probeDiagnostics';
import { isFreeCredential } from '@/lib/ai/rolePipeline/modelMeta';
import { gatewayFromModelProfile } from '@/lib/ai/rolePipeline/profiles';
import { runIdeToolLoop } from '@/lib/ai/tools/runToolLoop';
import { AiBudget, AiDispatchLock, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import type { TeamChatTurn } from '@/lib/ai/teamChat';
import type { ToolArtifact } from '@/lib/ai/tools/executeTool';

const LOCK_MS = 90000;

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

function appendArtifacts(text: string, artifacts: ToolArtifact[]): string {
  if (!artifacts.length) return text;
  const safe = artifacts.map((item) => `- Generated image: ${item.name} (asset ${item.assetId})`);
  return `${text}\n\n${safe.join('\n')}`.slice(0, 8000);
}

import { companyChatAdmissionMessage } from '@/lib/ai/companyChatAdmission';

/**
 * Governed IDE chat via a company credential (Direct or AI Team Worker binding).
 * Runs the image/browse tool loop when the host supports tools.
 */
export async function attemptCompanyCredentialChat(input: {
  systemPrompt: string;
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  userText: string;
  priorTurns: { role: 'user' | 'assistant' | 'status'; text: string }[];
  modelProfileId: string;
  model: string;
  includeImageTool?: boolean;
  /** Skip tools (e.g. Plan mode before Approve). */
  forcePlain?: boolean;
  signal?: AbortSignal;
}): Promise<TeamChatTurn> {
  let gateway;
  let profile;
  try {
    ({ gateway, profile } = await gatewayFromModelProfile(input.modelProfileId, input.model));
  } catch (error) {
    if (error instanceof GatewayError) {
      return statusTurn('Company credential or model id is unavailable.', error.code);
    }
    return statusTurn('Company credential or model id is unavailable.', 'configuration');
  }

  const freeCredential = isFreeCredential({ provider: profile.provider, tier: profile.tier });
  const lockToken = randomUUID();
  let runId: Types.ObjectId;
  let policy: Awaited<ReturnType<typeof getPipelineInferencePolicy>>;
  let reservationMicros = 0;

  try {
    const admitted = await aiTransaction(async (session) => {
      policy = await getPipelineInferencePolicy(
        input.organizationId,
        String(input.projectId),
        session,
        { requirePositiveReservation: !freeCredential }
      );
      reservationMicros = freeCredential ? 0 : policy.reservationMicros;
      const now = new Date();
      const lock = await AiDispatchLock.findById(DISPATCH_USAGE_ID).session(session);
      if (lock && lock.expiresAt > now) throw new GatewayError('unavailable');
      await AiDispatchLock.updateOne(
        { _id: DISPATCH_USAGE_ID },
        { $set: { token: lockToken, expiresAt: new Date(now.getTime() + LOCK_MS) } },
        { upsert: true, session }
      );
      // Company credentials call the org's own provider (OpenAI, local host, etc.).
      // Do not consume platform shared remote spacing/daily counters meant for the Nucleas shared endpoint.

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

      if (reservationMicros > 0) {
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
        await reserveRunBudget(input.organizationId, run._id, budgetIds, reservationMicros, session);
      }
      await AiRun.updateOne(
        { _id: run._id },
        { $set: { status: 'running', startedAt: now }, $inc: { revision: 1 } },
        { session }
      );
      return { runId: run._id, policy, reservationMicros };
    });
    runId = admitted.runId;
    policy = admitted.policy;
    reservationMicros = admitted.reservationMicros;
  } catch (error) {
    await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: lockToken }).catch(() => undefined);
    if (error instanceof GatewayError) {
      return statusTurn(companyChatAdmissionMessage(error.code), error.code);
    }
    return statusTurn(
      freeCredential
        ? 'Enable Remote connection and Processing in Admin → AI Settings before free/local chat can run.'
        : 'Paid chat needs processing enabled and a positive reservation within budget ceilings.',
      'unavailable'
    );
  }

  // Company credentials: only free/local are truly no-fee. Platform Admin "no provider fee"
  // applies to the shared remote endpoint, not org OpenAI/Anthropic keys.
  const noProviderFee = freeCredential;

  async function finish(args: {
    actualMicros: number | null;
    status: 'completed' | 'blocked';
    summary: string;
    failureCode?: string;
    result?: { inputTokens?: number | null; outputTokens?: number | null; latencyMs?: number | null };
  }) {
    try {
      await aiTransaction(async (session) => {
        await settleRunBudget(input.organizationId, runId, args.actualMicros, session);
        if (noProviderFee && reservationMicros > 0) {
          await decrementFreePoolRemaining(reservationMicros, session);
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
    } finally {
      // Always clear the shared lock, even if settle/Mongo fails mid-finish.
      await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: lockToken }).catch(() => undefined);
    }
  }

  if (input.signal?.aborted) {
    await finish({
      actualMicros: noProviderFee ? 0 : null,
      status: 'blocked',
      summary: 'Chat cancelled after admission.',
      failureCode: 'cancelled',
    }).catch(() => undefined);
    return statusTurn('The chat request was cancelled before completion.', 'cancelled', String(runId), {
      costMicros: noProviderFee ? 0 : null,
      reservedMicros: reservationMicros,
      noProviderFee,
    });
  }

  const history = input.priorTurns
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .slice(-8)
    .map((turn) => ({ role: turn.role as 'user' | 'assistant', content: turn.text.slice(0, 2000) }));

  // Reasoning models count reasoning tokens against max_completion_tokens; keep headroom for visible text.
  const chatTokenCap = usesMaxCompletionTokens(gateway.model) ? 4096 : 1024;
  const maxOutputTokens = Math.min(chatTokenCap, policy.maxOutputTokens);

  try {
    let loop: Awaited<ReturnType<typeof runIdeToolLoop>>;
    const usePlain = freeCredential || input.forcePlain;
    if (usePlain) {
      const plainHint = freeCredential
        ? 'Tools are not available on this free/local host; answer from knowledge only.'
        : 'Tools are disabled for this turn; answer from knowledge only.';
      const plain = await invokeModel(
        gateway,
        {
          role: 'architect',
          messages: [
            {
              role: 'system',
              content: `${input.systemPrompt} ${plainHint}`,
            },
            ...history,
            { role: 'user', content: input.userText.slice(0, 6000) },
          ],
          maxOutputTokens,
        },
        { signal: input.signal }
      );
      loop = {
        content: plain.content,
        toolCallsMade: [],
        artifacts: [],
        inputTokens: plain.inputTokens,
        outputTokens: plain.outputTokens,
        latencyMs: plain.latencyMs,
      };
    } else {
      try {
        loop = await runIdeToolLoop({
          gateway,
          messages: [
            { role: 'system', content: input.systemPrompt },
            ...history,
            { role: 'user', content: input.userText.slice(0, 6000) },
          ],
          maxOutputTokens,
          includeImageTool: input.includeImageTool !== false,
          organizationId: input.organizationId,
          projectId: input.projectId,
          userId: input.userId,
          runId,
          signal: input.signal,
        });
      } catch (toolError) {
        const retryPlain =
          toolError instanceof GatewayError &&
          (toolError.code === 'unavailable' || toolError.code === 'invalid_response');
        if (!retryPlain) throw toolError;

        const plain = await invokeModel(
          gateway,
          {
            role: 'architect',
            messages: [
              {
                role: 'system',
                content: `${input.systemPrompt} Tools failed on this host; answer from knowledge only.`,
              },
              ...history,
              { role: 'user', content: input.userText.slice(0, 6000) },
            ],
            maxOutputTokens,
          },
          { signal: input.signal }
        );
        loop = {
          content: plain.content,
          toolCallsMade: [],
          artifacts: [],
          inputTokens: plain.inputTokens,
          outputTokens: plain.outputTokens,
          latencyMs: plain.latencyMs,
        };
      }
    }

    const content = appendArtifacts(loop.content, loop.artifacts).trim();
    if (!content) {
      await finish({
        actualMicros: noProviderFee ? 0 : null,
        status: 'blocked',
        summary: 'Model returned empty chat content.',
        failureCode: 'invalid_response',
        result: loop,
      });
      return statusTurn(
        'The model returned an empty reply. No assistant content was stored.',
        'invalid_response',
        String(runId),
        { costMicros: noProviderFee ? 0 : null, reservedMicros: reservationMicros, noProviderFee }
      );
    }

    const settled = noProviderFee ? 0 : null;
    await finish({
      actualMicros: settled,
      status: 'completed',
      summary: `Chat completed${loop.toolCallsMade.length ? ` with tools: ${loop.toolCallsMade.join(',')}` : ''}.`,
      result: loop,
    });
    return {
      requestId: randomUUID(),
      role: 'assistant',
      text: content,
      runId: String(runId),
      costMicros: settled,
      reservedMicros: reservationMicros,
      noProviderFee,
      artifacts: loop.artifacts,
      toolsUsed: loop.toolCallsMade,
    };
  } catch (error) {
    const failureCode = error instanceof GatewayError ? error.code : classifyProbeFailure(error);
    await finish({
      actualMicros: noProviderFee ? 0 : null,
      status: 'blocked',
      summary: 'Chat model/tool call failed after admission.',
      failureCode,
    }).catch(() => undefined);

    if (error instanceof GatewayError) {
      const messagesByCode: Record<GatewayError['code'], string> = {
        configuration: 'Inference is not configured for this chat.',
        credentials: 'Remote authentication was rejected.',
        rate_limit: 'The remote provider rate-limited this request.',
        unavailable: freeCredential
          ? 'Local/free model host did not respond successfully. Check that the credential endpoint is publicly reachable over HTTPS and the model id is loaded.'
          : 'The remote model endpoint was unreachable or returned an error.',
        invalid_response: freeCredential
          ? 'This free/local host does not support tools like image generation. Use a commercial Direct credential (for example OpenAI) for image tools.'
          : 'The remote response could not be validated.',
        cancelled: 'The chat request was cancelled before completion.',
      };
      return statusTurn(messagesByCode[error.code], error.code, String(runId), {
        costMicros: noProviderFee ? 0 : null,
        reservedMicros: reservationMicros,
        noProviderFee,
      });
    }
    return statusTurn('The model call failed.', failureCode, String(runId), {
      costMicros: noProviderFee ? 0 : null,
      reservedMicros: reservationMicros,
      noProviderFee,
    });
  }
}
