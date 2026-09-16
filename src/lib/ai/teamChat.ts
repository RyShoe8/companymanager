import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { getChatInferencePolicy, getPipelineInferencePolicy } from '@/lib/ai/control/config';
import { GatewayError, invokeModel } from '@nucleas/ai-core/gateway';
import { digestValue } from '@nucleas/ai-core/planning';
import { reserveRunBudget, settleRunBudget } from '@/lib/ai/control/budgets';
import { decrementFreePoolRemaining } from '@/lib/ai/control/freePool';
import { reserveDispatch } from '@/lib/ai/control/dispatchLimits';
import {
  assertDispatchLockClaimable,
  claimDispatchLock,
  releaseDispatchLock,
} from '@/lib/ai/control/dispatchLock';
import { aiTransaction } from '@/lib/ai/control/transaction';
import { readSettings, platformSettingsId } from '@/lib/ai/control/settings';
import { defaultPlatformAiSettings, platformAiSettingsSchema } from '@/lib/ai/settingsSchema';
import { classifyProbeFailure } from '@/lib/ai/probeDiagnostics';
import { attemptCompanyCredentialChat } from '@/lib/ai/companyChat';
import type { IdeInteractionMode, IdePlanDocument } from '@/lib/ide/idePlan';
import type { IdeChatStageCallback } from '@/lib/ide/ideChatStream';
import { withStage } from '@/lib/ide/ideChatStream';
import {
  orchestraStagePrompt,
  shouldForcePlainChat,
  toolProfileForOrchestraStage,
} from '@/lib/ide/planModePrompt';
import { parseNucleasPlan } from '@/lib/ide/parseNucleasPlan';
import { parseReviewerGate } from '@/lib/ide/parseReviewerGate';
import { looksLikeProjectInternalQuery } from '@/lib/ai/tools/serverBrowseAssist';
import { gatherRepoAssistContext } from '@/lib/ai/tools/serverRepoAssist';
import { AiBudget, AiObjective, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import { AiRolePipeline } from '@/lib/models/AiRolePipeline';
import {
  aiEmployees,
  type AiEmployeeKey,
  type TeamContextSummary,
  type TeamMessageRole,
} from '@/lib/ai/teamWorkspace';

type PipelineStageBinding = {
  modelProfileId?: Types.ObjectId | string;
  model?: string;
};

export type TeamChatTurn = {
  requestId: string;
  role: TeamMessageRole;
  text: string;
  failureCategory?: string;
  /** Compact safe diagnostic for status turns (no secrets). */
  debugHint?: string;
  runId?: string;
  /** Settled cost when known; null when usage unknown after a paid run. */
  costMicros?: number | null;
  /** Admission reservation amount for honest reserved-cost UI. */
  reservedMicros?: number | null;
  noProviderFee?: boolean;
  artifacts?: { kind: 'image'; assetId: string; name: string; url: string }[];
  toolsUsed?: string[];
  plan?: IdePlanDocument;
};

function readStageBinding(
  pipeline: { planner?: PipelineStageBinding; worker?: PipelineStageBinding; reviewer?: PipelineStageBinding } | null | undefined,
  key: 'planner' | 'worker' | 'reviewer'
): { profileId: string; model: string } | null {
  const stage = pipeline?.[key];
  const profileId = stage?.modelProfileId ? String(stage.modelProfileId) : '';
  const model = stage?.model?.trim() ?? '';
  if (!profileId || !model) return null;
  return { profileId, model };
}

function mergeTurnCosts(turns: TeamChatTurn[]): {
  costMicros: number | null;
  reservedMicros: number;
  noProviderFee: boolean;
  toolsUsed: string[];
  artifacts: NonNullable<TeamChatTurn['artifacts']>;
} {
  let costMicros: number | null = 0;
  let reservedMicros = 0;
  let noProviderFee = true;
  const toolsUsed: string[] = [];
  const artifacts: NonNullable<TeamChatTurn['artifacts']> = [];
  for (const turn of turns) {
    if (costMicros != null) {
      if (turn.costMicros == null) costMicros = null;
      else costMicros += turn.costMicros;
    }
    reservedMicros += turn.reservedMicros ?? 0;
    noProviderFee = Boolean(noProviderFee && turn.noProviderFee);
    for (const tool of turn.toolsUsed ?? []) {
      if (!toolsUsed.includes(tool)) toolsUsed.push(tool);
    }
    artifacts.push(...(turn.artifacts ?? []));
  }
  return { costMicros, reservedMicros, noProviderFee, toolsUsed, artifacts };
}

const CHAT_LOCK_MS = 60000;

async function recentActivityCounts(organizationId: string, projectId: Types.ObjectId) {
  const scope = { organizationId, projectId };
  const [objectives, runs] = await Promise.all([
    AiObjective.find(scope).select('_id').sort({ createdAt: -1 }).limit(26).maxTimeMS(3000).lean(),
    AiRun.find(scope).select('_id').sort({ createdAt: -1 }).limit(26).maxTimeMS(3000).lean(),
  ]);
  return {
    recentObjectiveCount: Math.min(objectives.length, 25),
    recentRunCount: Math.min(runs.length, 25),
  };
}

function unavailableContext(
  projectName: string,
  reason: string,
  settings: { remoteEnabled: boolean; planningEnabled: boolean },
  counts: { recentObjectiveCount: number; recentRunCount: number }
): TeamContextSummary {
  return {
    projectName,
    inferenceReady: false,
    remoteEnabled: settings.remoteEnabled,
    planningEnabled: settings.planningEnabled,
    unavailableReason: reason,
    included: [
      `Project name: ${projectName}`,
      'Selected AI employee role preset',
      'Recent private thread turns for this employee (when available)',
      `Recent objectives in project: ${counts.recentObjectiveCount}${counts.recentObjectiveCount >= 25 ? '+' : ''}`,
      `Recent AI runs in project: ${counts.recentRunCount}${counts.recentRunCount >= 25 ? '+' : ''}`,
    ],
    ...counts,
  };
}

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

export async function buildTeamContextSummary(
  projectName: string,
  organizationId: string,
  projectId: Types.ObjectId
): Promise<TeamContextSummary> {
  const counts = await recentActivityCounts(organizationId, projectId).catch(() => ({
    recentObjectiveCount: 0,
    recentRunCount: 0,
  }));
  const platform = await readSettings(platformSettingsId);
  const parsed = platformAiSettingsSchema.safeParse(platform.value);
  const settings = parsed.success ? parsed.data : defaultPlatformAiSettings;
  if (!parsed.success) {
    return unavailableContext(
      projectName,
      'Platform AI settings are incomplete or inconsistent.',
      { remoteEnabled: false, planningEnabled: false },
      counts
    );
  }
  if (!settings.remoteEnabled) {
    return unavailableContext(
      projectName,
      'Remote inference connection is disabled in platform AI settings.',
      settings,
      counts
    );
  }
  if (!settings.dispatchEnabled) {
    return unavailableContext(
      projectName,
      'Queued AI processing is paused. Enable processing in Admin → AI Settings before team chat can call the model.',
      settings,
      counts
    );
  }
  try {
    await getPipelineInferencePolicy(organizationId, String(projectId), undefined, {
      requirePositiveReservation: false,
    });
  } catch {
    return unavailableContext(
      projectName,
      'Budget or reservation limits prevent AI inference. Check Admin → AI Settings and project budgets.',
      settings,
      counts
    );
  }
  return {
    projectName,
    inferenceReady: true,
    remoteEnabled: settings.remoteEnabled,
    planningEnabled: settings.planningEnabled,
    unavailableReason: null,
    included: [
      `Project name: ${projectName}`,
      'Selected AI employee Worker model from AI Team',
      'Recent private thread turns for this employee (when available)',
      `Recent objectives in project: ${counts.recentObjectiveCount}${counts.recentObjectiveCount >= 25 ? '+' : ''}`,
      `Recent AI runs in project: ${counts.recentRunCount}${counts.recentRunCount >= 25 ? '+' : ''}`,
      'Tools: web_search, image_search, web_fetch, optional browser_navigate, image_generate when supported',
    ],
    ...counts,
  };
}

type AdmittedChat = {
  runId: Types.ObjectId;
  lockToken: string;
  policy: Awaited<ReturnType<typeof getChatInferencePolicy>>;
};

async function admitTeamChat(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  userText: string;
}): Promise<{ ok: true; admitted: AdmittedChat } | { ok: false; turn: TeamChatTurn }> {
  const lockToken = randomUUID();
  try {
    return await aiTransaction(async (session) => {
      const policy = await getChatInferencePolicy(input.organizationId, String(input.projectId), session);
      const now = new Date();
      await assertDispatchLockClaimable(now, session);
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
        return {
          ok: false as const,
          turn: statusTurn(
            'Shared inference request limits were reached. No model call was sent. Wait for the next eligible window and try again.',
            'rate_limit'
          ),
        };
      }

      const inputDigest = digestValue(input.userText.slice(0, 6000));
      const [run] = await AiRun.create(
        [
          {
            organizationId: input.organizationId,
            projectId: input.projectId,
            role: 'architect',
            status: 'queued',
            createdByUserId: new Types.ObjectId(input.userId),
            inputDigest,
            policyDigest: policy.digest,
            model: policy.model,
          },
        ],
        { session }
      );

      await claimDispatchLock({
        token: lockToken,
        expiresAt: new Date(now.getTime() + CHAT_LOCK_MS),
        runId: run._id,
        session,
      });

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
            summary: 'Team chat admitted; budget reserved and shared dispatch claimed.',
          },
        ],
        { session }
      );
      return { ok: true as const, admitted: { runId: run._id, lockToken, policy } };
    });
  } catch (error) {
    await releaseDispatchLock(lockToken);
    if (error instanceof GatewayError) {
      const messages: Record<GatewayError['code'], string> = {
        configuration:
          'Chat inference needs remote connection, processing enabled, and a positive reservation within budget ceilings.',
        credentials: 'Remote authentication was rejected before the model was called.',
        rate_limit: 'Shared inference limits blocked this chat request.',
        unavailable: 'Another AI run currently holds the shared dispatch lock. Retry shortly.',
        invalid_response: 'Chat inference configuration is invalid.',
        cancelled: 'Chat admission was cancelled.',
      };
      return { ok: false, turn: statusTurn(messages[error.code], error.code) };
    }
    return {
      ok: false,
      turn: statusTurn('Chat admission failed before a model call was sent.', 'unavailable'),
    };
  }
}

async function finishTeamChatRun(input: {
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
  result?: { inputTokens?: number | null; outputTokens?: number | null; latencyMs?: number | null };
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
            ...(input.failureCode ? { failureCode: input.failureCode } : {}),
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
    await releaseDispatchLock(input.lockToken);
  }
}

function costFields(policy: { reservationMicros: number; noProviderFee: boolean }, settled: number | null) {
  return {
    costMicros: settled,
    reservedMicros: policy.reservationMicros,
    noProviderFee: policy.noProviderFee,
  };
}

/**
 * Distill planner output for downstream worker and reviewer stages.
 * Offloads context by stripping redundant JSON fences and structuring
 * ordered verification jobs, preventing context explosion on local models.
 */
export function distillPlannerBriefing(
  plannerText: string,
  interactionMode: IdeInteractionMode
): string {
  if (interactionMode === 'plan') {
    const parsed = parseNucleasPlan(plannerText);
    if (parsed) {
      const { plan, displayText } = parsed;
      const stepLines = plan.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
      const cleanDetails =
        displayText && displayText !== plan.summary ? displayText.slice(0, 8000).trim() : '';
      return [
        `Plan Goal: ${plan.title}`,
        `Summary: ${plan.summary}`,
        `\nVerification Jobs / Plan Steps to Ground with Repo Tools:\n${stepLines}`,
        cleanDetails ? `\nKey Architectural Details:\n${cleanDetails}` : '',
      ]
        .filter(Boolean)
        .join('\n')
        .trim();
    }
  }

  // Fallback for non-plan or unparsed output: strip excessive fences and trim
  return plannerText.replace(/```nucleas-plan\s*[\s\S]*?```/gi, '').trim().slice(0, 8000);
}

/** IDE / team role chat: always Planner → Worker → Reviewer on worker tabs. */
export async function attemptTeamChatReply(input: {
  employee: AiEmployeeKey;
  projectName: string;
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  userText: string;
  priorTurns: { role: TeamMessageRole; text: string }[];
  /** Optional project task rules injected into the system prompt (IDE). */
  ruleTexts?: string[];
  interactionMode?: IdeInteractionMode;
  /** When aborted (e.g. client Stop), cancels the gateway fetch and releases the dispatch lock. */
  signal?: AbortSignal;
  onStage?: IdeChatStageCallback;
}): Promise<TeamChatTurn> {
  const context = await buildTeamContextSummary(input.projectName, input.organizationId, input.projectId);
  if (!context.inferenceReady) {
    return statusTurn(context.unavailableReason ?? 'Inference is unavailable.', 'unavailable');
  }

  const pipeline = await AiRolePipeline.findOne({
    organizationId: input.organizationId,
    employee: input.employee,
    enabled: true,
  })
    .select('planner worker reviewer maxWorkerRetries')
    .maxTimeMS(3000)
    .lean();

  const interactionMode = input.interactionMode ?? 'chat';
  const plannerBinding = readStageBinding(pipeline, 'planner');
  const workerBinding = readStageBinding(pipeline, 'worker');
  const reviewerBinding = readStageBinding(pipeline, 'reviewer');

  if (!plannerBinding) {
    return statusTurn(
      `Configure a Planner company and model for ${input.employee} on AI Team before chatting.`,
      'configuration'
    );
  }
  if (!workerBinding) {
    return statusTurn(
      `Configure a Worker company and model for ${input.employee} on AI Team before chatting.`,
      'configuration'
    );
  }

  let repoContextBlock: string | undefined;
  if (looksLikeProjectInternalQuery(input.userText)) {
    try {
      const dig = await gatherRepoAssistContext({
        organizationId: input.organizationId,
        projectId: input.projectId,
        userText: input.userText,
      });
      if (!dig.ok && dig.okReads === 0) {
        return statusTurn(
          dig.note ||
            'Repository is unavailable for this project. Bind a GitHub repository or connect the GitHub App, then retry.',
          'unavailable'
        );
      }
      if (dig.okReads === 0 && !dig.evidenceBlock.trim()) {
        return statusTurn(
          `Could not read repository files (${dig.note}). Bind GitHub or reconnect the GitHub App, then retry.`,
          'unavailable'
        );
      }
      const block = (dig.evidenceBlock || dig.contextBlock).trim();
      if (block) repoContextBlock = block.slice(0, 48_000);
    } catch {
      return statusTurn(
        'Repository dig failed before orchestra could start. Check GitHub bind/App connection and retry.',
        'unavailable'
      );
    }
  }

  const role = aiEmployees.find((item) => item.id === input.employee)!;
  const ruleBlock =
    input.ruleTexts && input.ruleTexts.length > 0
      ? ['Project task rules you must follow:', ...input.ruleTexts.map((rule, index) => `${index + 1}. ${rule}`)].join(
          '\n'
        )
      : null;

  const sharedContext = [
    `You are on the ${role.name} AI Team for the Nucleas project "${input.projectName}".`,
    role.description,
    `This project has about ${context.recentObjectiveCount} recent objectives and ${context.recentRunCount} recent AI runs recorded in Nucleas.`,
    'Do not claim to have changed project data or completed tasks outside this chat.',
    'If you lack information or tools, say what is missing instead of inventing project or web facts.',
    ...(ruleBlock ? [ruleBlock] : []),
  ]
    .filter(Boolean)
    .join(' ');

  async function runStage(args: {
    stage: 'planner' | 'worker' | 'reviewer';
    binding: { profileId: string; model: string };
    userText: string;
    priorTurns: { role: TeamMessageRole; text: string }[];
  }): Promise<TeamChatTurn> {
    if (input.signal?.aborted) {
      return statusTurn('The chat request was cancelled before completion.', 'cancelled');
    }
    const toolProfile = toolProfileForOrchestraStage(args.stage, interactionMode);
    const allowTools = toolProfile !== 'none';
    const systemPrompt = [
      sharedContext,
      `Pipeline stage: ${args.stage}.`,
      orchestraStagePrompt(args.stage, interactionMode),
      allowTools
        ? 'You may call provided tools. Never claim browse, repo, or image results without tool output. If a tool fails, say so from the error—do not invent results.'
        : 'Do not call tools in this turn.',
      allowTools && toolProfile === 'full'
        ? 'Prefer repo_tree/repo_read for this codebase; web_search/web_fetch only for external facts; browser_navigate only when fetch is thin.'
        : allowTools
          ? 'Use repo_tree/repo_read to inspect the bound repository.'
          : '',
    ]
      .filter(Boolean)
      .join(' ');

    return withStage(input.onStage, args.stage, () =>
      attemptCompanyCredentialChat({
        systemPrompt,
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        userText: args.userText,
        priorTurns: args.priorTurns,
        modelProfileId: args.binding.profileId,
        model: args.binding.model,
        includeImageTool: toolProfile === 'full',
        includeRepoTools: toolProfile !== 'none',
        toolProfile,
        forcePlain: toolProfile === 'none' || shouldForcePlainChat(interactionMode),
        forceToolLoop: toolProfile !== 'none',
        stopOnUpstreamFailure: true,
        repoContextBlock: args.stage === 'planner' ? repoContextBlock : undefined,
        maxOutputTokensOverride:
          args.stage === 'planner'
            ? interactionMode === 'plan' || interactionMode === 'build'
              ? 8192
              : undefined
            : interactionMode === 'plan'
              ? 2048
              : interactionMode === 'build'
                ? 4096
                : undefined,
        signal: input.signal,
      })
    );
  }

  if (input.signal?.aborted) {
    return statusTurn('The chat request was cancelled before completion.', 'cancelled');
  }

  const plannerTurn = await runStage({
    stage: 'planner',
    binding: plannerBinding,
    userText: input.userText,
    priorTurns: input.priorTurns,
  });
  if (plannerTurn.role !== 'assistant') return plannerTurn;

  // Preserve paid planning work without exposing an unverified, approvable plan.
  function interruptedStage(stage: 'Worker' | 'Reviewer', failed: TeamChatTurn, turns: TeamChatTurn[]): TeamChatTurn {
    const costs = mergeTurnCosts(turns);
    const draft = interactionMode === 'plan'
      ? parseNucleasPlan(plannerTurn.text)?.displayText ?? plannerTurn.text.replace(/```nucleas-plan\s*[\s\S]*?```/gi, '').trim()
      : '';
    return {
      ...failed,
      role: 'status',
      plan: undefined,
      text: [
        `${stage} stage (${stage === 'Worker' ? workerBinding!.model : reviewerBinding!.model}) did not complete.`,
        failed.text,
        ...(draft ? ['Planner draft preserved below — verification incomplete; not approved or ready to build.', draft] : []),
      ].join('\n\n'),
      ...costs,
    };
  }

  /** Circuit breaker: Worker↔Reviewer continue passes based on pipeline setting (defaults to 5 retries = 6 passes). */
  const maxWorkerRetries = typeof (pipeline as { maxWorkerRetries?: number } | null)?.maxWorkerRetries === 'number'
    ? (pipeline as { maxWorkerRetries?: number })!.maxWorkerRetries!
    : 5;
  const maxCompletionPasses = Math.max(1, maxWorkerRetries + 1);

  if (input.signal?.aborted) {
    return statusTurn('The chat request was cancelled before completion.', 'cancelled', plannerTurn.runId, {
      costMicros: plannerTurn.costMicros,
      reservedMicros: plannerTurn.reservedMicros,
      noProviderFee: plannerTurn.noProviderFee,
    });
  }

  const distilledPlanner = distillPlannerBriefing(plannerTurn.text, interactionMode);

  let workerTurn = await runStage({
    stage: 'worker',
    binding: workerBinding,
    userText: [
      'User request:',
      input.userText.slice(0, 2000),
      '',
      'Planner briefing / jobs:',
      distilledPlanner,
    ].join('\n'),
    priorTurns: [],
  });
  if (workerTurn.role !== 'assistant') {
    return interruptedStage('Worker', workerTurn, [plannerTurn, workerTurn]);
  }

  let plan: IdePlanDocument | undefined;
  if (interactionMode === 'plan') {
    const parsed = parseNucleasPlan(plannerTurn.text);
    if (parsed) plan = parsed.plan;
  }

  const assistantStages: TeamChatTurn[] = [plannerTurn, workerTurn];
  let reviewerTurn: TeamChatTurn | null = null;
  let finalChatAnswer: string | null = null;

  if (reviewerBinding) {
    for (let pass = 0; pass < maxCompletionPasses; pass += 1) {
      if (input.signal?.aborted) {
        const costs = mergeTurnCosts(assistantStages);
        return statusTurn('The chat request was cancelled before completion.', 'cancelled', workerTurn.runId, {
          costMicros: costs.costMicros,
          reservedMicros: costs.reservedMicros,
          noProviderFee: costs.noProviderFee,
        });
      }
      reviewerTurn = await runStage({
        stage: 'reviewer',
        binding: reviewerBinding,
        userText: [
          'User request:',
          input.userText.slice(0, 1500),
          '',
          'Planner briefing:',
          distilledPlanner,
          '',
          'Worker output:',
          workerTurn.text.slice(0, 6000),
          '',
          'Decide accept vs needs_more. End with a nucleas-gate fence (all interaction modes).',
        ].join('\n'),
        priorTurns: [],
      });
      assistantStages.push(reviewerTurn);
      if (reviewerTurn.role !== 'assistant' || !reviewerTurn.text.trim()) {
        return interruptedStage('Reviewer', reviewerTurn, assistantStages);
      }

      const gate = parseReviewerGate(reviewerTurn.text);
      if (gate.status === 'accept') {
        finalChatAnswer = gate.answer.trim() || reviewerTurn.text.trim();
        break;
      }

      if (pass >= maxCompletionPasses - 1) {
        plan = undefined; // A needs_more gate must never publish a ready-for-review plan.
        // Circuit breaker: return best effort from last Worker + Reviewer prose.
        finalChatAnswer =
          [
            workerTurn.text.trim(),
            '',
            '---',
            'Analysis stopped after the safety continue limit before the Reviewer fully accepted.',
            gate.reason ? `Still missing: ${gate.reason}` : '',
            gate.jobs.length ? `Remaining jobs: ${gate.jobs.join('; ')}` : '',
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, 24_000);
        break;
      }

      if (input.signal?.aborted) {
        const costs = mergeTurnCosts(assistantStages);
        return statusTurn('The chat request was cancelled before completion.', 'cancelled', workerTurn.runId, {
          costMicros: costs.costMicros,
          reservedMicros: costs.reservedMicros,
          noProviderFee: costs.noProviderFee,
        });
      }

      workerTurn = await runStage({
        stage: 'worker',
        binding: workerBinding,
        userText: [
          'User request:',
          input.userText.slice(0, 2000),
          '',
          'Planner briefing / jobs:',
          distilledPlanner,
          '',
          'Reviewer needs_more — execute these jobs completely with repo_tree/repo_read and quoted evidence:',
          ...gate.jobs.map((job, index) => `${index + 1}. ${job}`),
          gate.reason ? `Reason: ${gate.reason}` : '',
          '',
          'Prior Worker findings (continue from these; do not discard):',
          workerTurn.text.slice(0, 4000),
        ]
          .filter(Boolean)
          .join('\n'),
        priorTurns: [],
      });
      assistantStages.push(workerTurn);
      if (workerTurn.role !== 'assistant') {
        return interruptedStage('Worker', workerTurn, assistantStages);
      }
    }
  }

  const costs = mergeTurnCosts(assistantStages.filter((t) => t.role === 'assistant'));
  if (!reviewerBinding) plan = undefined;

  function reviewerUserFacingText(raw: string): string {
    if (finalChatAnswer) return finalChatAnswer.trim();
    const gate = parseReviewerGate(raw);
    if (gate.status === 'accept') return gate.answer.trim();
    return raw.replace(/```nucleas-gate\s*[\s\S]*?```/i, '').trim() || raw.trim();
  }

  if (reviewerTurn?.role === 'assistant' && reviewerTurn.text.trim()) {
    if (interactionMode === 'chat') {
      return {
        ...reviewerTurn,
        text: reviewerUserFacingText(reviewerTurn.text),
        toolsUsed: costs.toolsUsed,
        artifacts: costs.artifacts,
        costMicros: costs.costMicros,
        reservedMicros: costs.reservedMicros,
        noProviderFee: costs.noProviderFee,
        ...(plan ? { plan } : {}),
      };
    }

    if (interactionMode === 'plan' && plan) {
      const display = parseNucleasPlan(plannerTurn.text)?.displayText ?? plannerTurn.text.trim();
      return {
        ...workerTurn,
        text: [
          display,
          '',
          '---',
          '**Worker verification:**',
          workerTurn.text.trim(),
          '',
          '---',
          `**Reviewer (${reviewerBinding!.model}):**`,
          reviewerUserFacingText(reviewerTurn.text),
        ].join('\n'),
        toolsUsed: costs.toolsUsed,
        artifacts: costs.artifacts,
        costMicros: costs.costMicros,
        reservedMicros: costs.reservedMicros,
        noProviderFee: costs.noProviderFee,
        plan,
      };
    }

    return {
      ...workerTurn,
      text: [
        workerTurn.text.trim(),
        '',
        '---',
        `**Reviewer (${reviewerBinding!.model}):**`,
        reviewerUserFacingText(reviewerTurn.text),
      ].join('\n'),
      toolsUsed: costs.toolsUsed,
      artifacts: costs.artifacts,
      costMicros: costs.costMicros,
      reservedMicros: costs.reservedMicros,
      noProviderFee: costs.noProviderFee,
      ...(plan ? { plan } : {}),
    };
  }

  return {
    ...workerTurn,
    text: workerTurn.text.trim(),
    toolsUsed: costs.toolsUsed,
    artifacts: costs.artifacts,
    costMicros: costs.costMicros,
    reservedMicros: costs.reservedMicros,
    noProviderFee: costs.noProviderFee,
    ...(plan ? { plan } : {}),
  };
}
