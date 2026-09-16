import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { getChatInferencePolicy, getPipelineInferencePolicy } from '@/lib/ai/control/config';
import { GatewayError, invokeModel } from '@nucleas/ai-core/gateway';
import { digestValue } from '@nucleas/ai-core/planning';
import { reserveRunBudget, settleRunBudget } from '@/lib/ai/control/budgets';
import { decrementFreePoolRemaining } from '@/lib/ai/control/freePool';
import { DISPATCH_USAGE_ID, reserveDispatch } from '@/lib/ai/control/dispatchLimits';
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
import { looksLikeProjectInternalQuery } from '@/lib/ai/tools/serverBrowseAssist';
import { gatherRepoAssistContext } from '@/lib/ai/tools/serverRepoAssist';
import { AiBudget, AiDispatchLock, AiObjective, AiRun, AiRunEvent } from '@/lib/models/AiControl';
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
      'Enable Remote connection and Processing in Admin → AI Settings before IDE chat can run.',
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
      const lock = await AiDispatchLock.findById(DISPATCH_USAGE_ID).session(session);
      if (lock && lock.expiresAt > now) {
        return {
          ok: false as const,
          turn: statusTurn('Shared inference is busy. Try again after the current request finishes.', 'unavailable'),
        };
      }
      await AiDispatchLock.updateOne(
        { _id: DISPATCH_USAGE_ID },
        { $set: { token: lockToken, expiresAt: new Date(now.getTime() + CHAT_LOCK_MS) } },
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
    if (error instanceof GatewayError) {
      const messages: Record<GatewayError['code'], string> = {
        configuration:
          'Chat inference needs remote connection, processing enabled, and a positive reservation within budget ceilings.',
        credentials: 'Remote authentication was rejected before the model was called.',
        rate_limit: 'Shared inference limits blocked this chat request.',
        unavailable: 'Chat inference is temporarily unavailable.',
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
    await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token: input.lockToken }).catch(() => undefined);
  }
}

function costFields(policy: { reservationMicros: number; noProviderFee: boolean }, settled: number | null) {
  return {
    costMicros: settled,
    reservedMicros: policy.reservationMicros,
    noProviderFee: policy.noProviderFee,
  };
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
    .select('planner worker reviewer')
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
        signal: input.signal,
      })
    );
  }

  const plannerTurn = await runStage({
    stage: 'planner',
    binding: plannerBinding,
    userText: input.userText,
    priorTurns: input.priorTurns,
  });
  if (plannerTurn.role !== 'assistant') return plannerTurn;

  const workerTurn = await runStage({
    stage: 'worker',
    binding: workerBinding,
    userText: [
      'User request:',
      input.userText.slice(0, 4000),
      '',
      'Planner briefing / jobs:',
      plannerTurn.text.slice(0, 1500),
    ].join('\n'),
    priorTurns: [],
  });
  if (workerTurn.role !== 'assistant') {
    const costs = mergeTurnCosts([plannerTurn, workerTurn]);
    return {
      ...workerTurn,
      toolsUsed: costs.toolsUsed,
      artifacts: costs.artifacts,
      costMicros: costs.costMicros,
      reservedMicros: costs.reservedMicros,
      noProviderFee: costs.noProviderFee,
    };
  }

  let plan: IdePlanDocument | undefined;
  if (interactionMode === 'plan') {
    const parsed = parseNucleasPlan(plannerTurn.text);
    if (parsed) plan = parsed.plan;
  }

  let reviewerTurn: TeamChatTurn | null = null;
  if (reviewerBinding) {
    let digEvidence = '';
    const needsRepoEvidence =
      looksLikeProjectInternalQuery(input.userText) ||
      (workerTurn.toolsUsed ?? []).some((name) => name === 'repo_read' || name === 'repo_tree');
    if (needsRepoEvidence) {
      try {
        const dig = await gatherRepoAssistContext({
          organizationId: input.organizationId,
          projectId: input.projectId,
          userText: input.userText,
        });
        digEvidence = (dig.evidenceBlock || dig.contextBlock).slice(0, 24_000);
      } catch {
        digEvidence = '';
      }
    }

    reviewerTurn = await runStage({
      stage: 'reviewer',
      binding: reviewerBinding,
      userText: [
        'User request:',
        input.userText.slice(0, 2000),
        '',
        'Planner output:',
        plannerTurn.text.slice(0, 4000),
        '',
        'Worker output:',
        workerTurn.text.slice(0, 20_000),
        digEvidence
          ? `\n\nNucleas repository dig excerpts (authoritative; explain from these):\n${digEvidence}`
          : '',
      ].join('\n'),
      priorTurns: [],
    });
  }

  const stages = [plannerTurn, workerTurn, ...(reviewerTurn ? [reviewerTurn] : [])];
  const costs = mergeTurnCosts(stages.filter((t) => t.role === 'assistant'));

  if (reviewerTurn?.role === 'assistant' && reviewerTurn.text.trim()) {
    if (interactionMode === 'chat') {
      return {
        ...reviewerTurn,
        text: reviewerTurn.text.trim(),
        toolsUsed: costs.toolsUsed,
        artifacts: costs.artifacts,
        costMicros: costs.costMicros,
        reservedMicros: costs.reservedMicros,
        noProviderFee: costs.noProviderFee,
        ...(plan ? { plan } : {}),
      };
    }

    const workerBody =
      interactionMode === 'plan' && plan
        ? parseNucleasPlan(plannerTurn.text)?.displayText ?? plannerTurn.text.trim()
        : workerTurn.text.trim();
    return {
      ...workerTurn,
      text: `${workerBody}\n\n---\n**Reviewer (${reviewerBinding!.model}):**\n${reviewerTurn.text.trim()}`,
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
      text: `${display}\n\n---\n**Worker findings:**\n${workerTurn.text.trim()}`,
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
    text: workerTurn.text.trim(),
    toolsUsed: costs.toolsUsed,
    artifacts: costs.artifacts,
    costMicros: costs.costMicros,
    reservedMicros: costs.reservedMicros,
    noProviderFee: costs.noProviderFee,
    ...(plan ? { plan } : {}),
  };
}
