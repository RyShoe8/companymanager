import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import {
  GatewayError,
  invokeModel,
  usesMaxCompletionTokens,
  type GatewayConfiguration,
} from '@nucleas/ai-core/gateway';
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
import type { IdeToolProfile } from '@/lib/ai/tools/definitions';
import { imageSearch, webSearch } from '@/lib/ai/tools/webSearch';
import {
  formatImageSearchContext,
  formatResearchResultContext,
  looksLikeImageSearchQuery,
  looksLikeWebLookupQuery,
  userTextWithBrowseContext,
} from '@/lib/ai/tools/serverBrowseAssist';
import { AiBudget, AiDispatchLock, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import type { TeamChatTurn } from '@/lib/ai/teamChat';
import type { ToolArtifact } from '@/lib/ai/tools/executeTool';

const LOCK_MS = 90000;

function statusTurn(
  text: string,
  failureCategory: string,
  runId?: string,
  cost?: {
    costMicros?: number | null;
    reservedMicros?: number | null;
    noProviderFee?: boolean;
    debugHint?: string;
  }
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
    ...(cost?.debugHint ? { debugHint: cost.debugHint.slice(0, 400) } : {}),
  };
}

function appendArtifacts(text: string, artifacts: ToolArtifact[]): string {
  if (!artifacts.length) return text;
  const safe = artifacts.map((item) => `- Generated image: ${item.name} (asset ${item.assetId})`);
  return `${text}\n\n${safe.join('\n')}`.slice(0, 8000);
}

const TOOL_NEEDY =
  /\b(image|photo|picture|generate|draw|screenshot|browse|fetch|navigate|web[_ ]?search|search the web|image[_ ]?search)\b/i;

function looksLikeToolNeedyQuery(text: string): boolean {
  return TOOL_NEEDY.test(text.trim());
}

type ChatPhase =
  | 'proactive_browse'
  | 'plain_first'
  | 'tool_loop'
  | 'browse_assist_retry'
  | 'plain_retry'
  | 'empty_content';

function formatDebugHint(parts: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ')
    .slice(0, 400);
}

function gatewayDebugParts(error: unknown): Record<string, string | number | boolean | null | undefined> {
  if (!(error instanceof GatewayError)) {
    return { err: error instanceof Error ? error.name : 'unknown' };
  }
  const details = error.details;
  return {
    code: error.code,
    kind: details?.kind,
    httpStatus: details?.httpStatus,
    finishReason: details?.finishReason,
    contentChars: details?.contentChars,
    hasToolCalls: details?.hasToolCalls,
    hasReasoning: details?.hasReasoning,
  };
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
  /** When false, omit GitHub repo tools (Free Chat). Default true. */
  includeRepoTools?: boolean;
  /** Restrict tool catalog. Plan mode should use `repo`. */
  toolProfile?: IdeToolProfile;
  /** Skip tools (e.g. forced plain completion). */
  forcePlain?: boolean;
  signal?: AbortSignal;
}): Promise<TeamChatTurn> {
  let gateway: GatewayConfiguration;
  let profile: Awaited<ReturnType<typeof gatewayFromModelProfile>>['profile'];
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
    let loop: Awaited<ReturnType<typeof runIdeToolLoop>> | undefined;
    let browseAssisted = false;
    let phase: ChatPhase = 'tool_loop';
    let lastError: unknown;
    const usePlain = Boolean(input.forcePlain) || input.toolProfile === 'none';
    const isImageLookup = looksLikeImageSearchQuery(input.userText);
    const isLookup = !isImageLookup && looksLikeWebLookupQuery(input.userText);
    const toolNeedy = looksLikeToolNeedyQuery(input.userText);

    async function plainInvoke(args: {
      systemExtra: string;
      userContent: string;
    }) {
      return invokeModel(
        gateway,
        {
          role: 'architect',
          messages: [
            {
              role: 'system',
              content: `${input.systemPrompt} ${args.systemExtra}`,
            },
            ...history,
            { role: 'user', content: args.userContent.slice(0, 6000) },
          ],
          maxOutputTokens,
        },
        { signal: input.signal }
      );
    }

    async function tryBrowseAssistPlain(systemExtra: string): Promise<{
      content: string;
      toolCallsMade: string[];
      artifacts: ToolArtifact[];
      inputTokens: number | null;
      outputTokens: number | null;
      latencyMs: number;
    } | null> {
      if (!freeCredential || !isLookup) return null;
      const search = await webSearch(input.userText, {
        signal: input.signal,
        depth: 'standard',
        organizationId: input.organizationId,
      });
      browseAssisted = true;
      const toolsUsed = search.toolsUsed?.length ? search.toolsUsed : ['web_search'];
      const block = formatResearchResultContext(search);
      const plain = await plainInvoke({
        systemExtra: `${systemExtra} Answer directly. Do not call tools. Nucleas already ran research (${toolsUsed.join(', ')}); ground your answer in the provided sources and extracts.`,
        userContent: userTextWithBrowseContext(input.userText, block),
      });
      return {
        content: plain.content,
        toolCallsMade: toolsUsed,
        artifacts: [],
        inputTokens: plain.inputTokens,
        outputTokens: plain.outputTokens,
        latencyMs: plain.latencyMs,
      };
    }

    async function tryImageAssistPlain(systemExtra: string): Promise<{
      content: string;
      toolCallsMade: string[];
      artifacts: ToolArtifact[];
      inputTokens: number | null;
      outputTokens: number | null;
      latencyMs: number;
    } | null> {
      if (!freeCredential || !isImageLookup) return null;
      const search = await imageSearch(input.userText, {
        signal: input.signal,
        organizationId: input.organizationId,
      });
      browseAssisted = true;
      const toolsUsed = search.toolsUsed?.length ? search.toolsUsed : ['image_search'];
      const block = formatImageSearchContext(search);
      const plain = await plainInvoke({
        systemExtra: `${systemExtra} Answer directly. Do not call tools. Nucleas already ran image_search; list the concrete image URLs from the results (markdown links are fine). Do not invent URLs.`,
        userContent: userTextWithBrowseContext(input.userText, block),
      });
      return {
        content: plain.content,
        toolCallsMade: toolsUsed,
        artifacts: [],
        inputTokens: plain.inputTokens,
        outputTokens: plain.outputTokens,
        latencyMs: plain.latencyMs,
      };
    }

    async function runToolLoopPhase() {
      phase = 'tool_loop';
      return runIdeToolLoop({
        gateway,
        messages: [
          { role: 'system', content: input.systemPrompt },
          ...history,
          { role: 'user', content: input.userText.slice(0, 6000) },
        ],
        maxOutputTokens,
        includeImageTool: input.includeImageTool !== false,
        includeRepoTools: input.includeRepoTools !== false,
        toolProfile: input.toolProfile ?? 'full',
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        runId,
        signal: input.signal,
      });
    }

    if (usePlain) {
      phase = 'plain_first';
      try {
        const plain = await plainInvoke({
          systemExtra: 'Tools are disabled for this turn; answer from knowledge only. Do not call tools.',
          userContent: input.userText,
        });
        loop = {
          content: plain.content,
          toolCallsMade: [],
          artifacts: [],
          inputTokens: plain.inputTokens,
          outputTokens: plain.outputTokens,
          latencyMs: plain.latencyMs,
        };
      } catch (plainError) {
        lastError = plainError;
        const retryBrowse =
          freeCredential &&
          (plainError instanceof GatewayError
            ? plainError.code === 'unavailable' || plainError.code === 'invalid_response'
            : isLookup || isImageLookup);
        if (!retryBrowse) throw plainError;
        phase = 'browse_assist_retry';
        const assisted =
          (await tryImageAssistPlain('Tools are disabled for this turn.')) ??
          (await tryBrowseAssistPlain('Tools are disabled for this turn.'));
        if (!assisted) throw plainError;
        loop = assisted;
      }
    } else if (freeCredential) {
      let resolved = false;

      if (isImageLookup) {
        phase = 'proactive_browse';
        try {
          const assisted = await tryImageAssistPlain(
            'Prefer Nucleas image_search for finding existing web images.'
          );
          if (assisted) {
            loop = assisted;
            resolved = true;
          }
        } catch (browseError) {
          lastError = browseError;
        }
      }

      if (!resolved && isLookup) {
        phase = 'proactive_browse';
        try {
          const assisted = await tryBrowseAssistPlain(
            'Prefer Nucleas web_search for this factual lookup.'
          );
          if (assisted) {
            loop = assisted;
            resolved = true;
          }
        } catch (browseError) {
          lastError = browseError;
          // Fall through to plain / tools; never surface raw search errors alone.
        }
      }

      if (!resolved && !toolNeedy) {
        phase = 'plain_first';
        try {
          const plain = await plainInvoke({
            systemExtra: 'Answer directly and briefly. Do not call tools.',
            userContent: input.userText,
          });
          loop = {
            content: plain.content,
            toolCallsMade: [],
            artifacts: [],
            inputTokens: plain.inputTokens,
            outputTokens: plain.outputTokens,
            latencyMs: plain.latencyMs,
          };
          resolved = true;
        } catch (plainError) {
          lastError = plainError;
        }
      }

      if (!resolved && (toolNeedy || !loop)) {
        try {
          loop = await runToolLoopPhase();
          resolved = true;
        } catch (toolError) {
          lastError = toolError;
          phase = 'browse_assist_retry';
          let assisted: Awaited<ReturnType<typeof tryBrowseAssistPlain>> = null;
          try {
            assisted =
              (await tryImageAssistPlain('Tools failed on this host.')) ??
              (await tryBrowseAssistPlain('Tools failed on this host.'));
          } catch (assistError) {
            lastError = assistError;
            assisted = null;
          }
          if (assisted) {
            loop = assisted;
            resolved = true;
          } else {
            phase = 'plain_retry';
            try {
              const plain = await plainInvoke({
                systemExtra:
                  (isLookup || isImageLookup) && browseAssisted
                    ? 'Tools and browse assist failed; answer from knowledge only. Do not call tools.'
                    : 'Tools failed on this host; answer from knowledge only. Do not call tools.',
                userContent: input.userText,
              });
              loop = {
                content: plain.content,
                toolCallsMade: [],
                artifacts: [],
                inputTokens: plain.inputTokens,
                outputTokens: plain.outputTokens,
                latencyMs: plain.latencyMs,
              };
              resolved = true;
            } catch (plainError) {
              lastError = plainError;
              if ((isLookup || isImageLookup) && browseAssisted === false) {
                throw new GatewayError('unavailable', {
                  ...(plainError instanceof GatewayError ? plainError.details : {}),
                  kind: 'browse_unavailable',
                });
              }
              throw plainError;
            }
          }
        }
      }

      if (!resolved || !loop) {
        throw lastError instanceof Error
          ? lastError
          : new GatewayError('invalid_response', { kind: 'unresolved' });
      }
    } else {
      try {
        loop = await runToolLoopPhase();
      } catch (toolError) {
        lastError = toolError;
        const retryableGateway =
          toolError instanceof GatewayError &&
          (toolError.code === 'unavailable' || toolError.code === 'invalid_response');
        if (!retryableGateway) throw toolError;
        phase = 'plain_retry';
        const plain = await plainInvoke({
          systemExtra: 'Tools failed on this host; answer from knowledge only. Do not call tools.',
          userContent: input.userText,
        });
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

    if (!loop) {
      throw new GatewayError('invalid_response', { kind: 'unresolved', contentChars: 0 });
    }

    const content = appendArtifacts(loop.content, loop.artifacts).trim();
    if (!content) {
      phase = 'empty_content';
      const hint = formatDebugHint({
        phase,
        browseAssisted,
        contentChars: 0,
        tools: loop.toolCallsMade.join(',') || 'none',
      });
      await finish({
        actualMicros: noProviderFee ? 0 : null,
        status: 'blocked',
        summary: `Model returned empty chat content. ${hint}`.slice(0, 500),
        failureCode: 'invalid_response',
        result: loop,
      });
      return statusTurn(
        browseAssisted
          ? 'Browse ran on Nucleas but the model returned no usable text. Check that the model id is loaded and the endpoint accepts plain chat requests.'
          : 'The model returned an empty reply. No assistant content was stored.',
        'invalid_response',
        String(runId),
        {
          costMicros: noProviderFee ? 0 : null,
          reservedMicros: reservationMicros,
          noProviderFee,
          debugHint: hint,
        }
      );
    }

    const settled = noProviderFee ? 0 : null;
    await finish({
      actualMicros: settled,
      status: 'completed',
      summary: `Chat completed${loop.toolCallsMade.length ? ` with tools: ${loop.toolCallsMade.join(',')}` : ''}${browseAssisted ? ' (Nucleas browse assist)' : ''} phase=${phase}.`.slice(
        0,
        500
      ),
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
    const hint = formatDebugHint({
      phase: 'failed',
      ...gatewayDebugParts(error),
      probe: failureCode,
    });
    await finish({
      actualMicros: noProviderFee ? 0 : null,
      status: 'blocked',
      summary: `Chat model/tool call failed after admission. ${hint}`.slice(0, 500),
      failureCode,
    }).catch(() => undefined);

    if (error instanceof GatewayError) {
      const messagesByCode: Record<GatewayError['code'], string> = {
        configuration: 'Inference is not configured for this chat.',
        credentials: 'Remote authentication was rejected.',
        rate_limit: 'The remote provider rate-limited this request.',
        unavailable: freeCredential
          ? error.details?.kind === 'browse_unavailable'
            ? 'Nucleas web search could not ground this answer and the local model did not return usable text. Try again or pick another model.'
            : 'Local/free model host did not respond successfully. Check that the credential endpoint is publicly reachable over HTTPS and the model id is loaded.'
          : 'The remote model endpoint was unreachable or returned an error.',
        invalid_response: freeCredential
          ? 'This free/local host returned an invalid response. Check that the model id is loaded and the endpoint accepts the request (including tools if used). Browse may have run on Nucleas without usable model text.'
          : 'The remote response could not be validated.',
        cancelled: 'The chat request was cancelled before completion.',
      };
      return statusTurn(messagesByCode[error.code], error.code, String(runId), {
        costMicros: noProviderFee ? 0 : null,
        reservedMicros: reservationMicros,
        noProviderFee,
        debugHint: hint,
      });
    }
    return statusTurn('The model call failed.', failureCode, String(runId), {
      costMicros: noProviderFee ? 0 : null,
      reservedMicros: reservationMicros,
      noProviderFee,
      debugHint: hint,
    });
  }
}
