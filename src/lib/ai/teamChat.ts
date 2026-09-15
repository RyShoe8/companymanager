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
import { appendInteractionModePrompt, shouldForcePlainChat } from '@/lib/ide/planModePrompt';
import { parseNucleasPlan } from '@/lib/ide/parseNucleasPlan';
import { AiBudget, AiDispatchLock, AiObjective, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import { AiRolePipeline } from '@/lib/models/AiRolePipeline';
import {
  aiEmployees,
  type AiEmployeeKey,
  type TeamContextSummary,
  type TeamMessageRole,
} from '@/lib/ai/teamWorkspace';

export type TeamChatTurn = {
  requestId: string;
  role: TeamMessageRole;
  text: string;
  failureCategory?: string;
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
      'Tools: web_search, web_fetch, optional browser_navigate, image_generate when supported',
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

/** IDE / team role chat via that employee's AI Team Worker company binding + tool loop. */
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
    .select('worker')
    .maxTimeMS(3000)
    .lean();
  const workerProfileId = pipeline?.worker?.modelProfileId
    ? String(pipeline.worker.modelProfileId)
    : '';
  const workerModel = pipeline?.worker?.model?.trim() ?? '';
  if (!workerProfileId || !workerModel) {
    return statusTurn(
      `Configure a Worker company and model for ${input.employee} on AI Team before chatting.`,
      'configuration'
    );
  }

  const interactionMode = input.interactionMode ?? 'chat';

  const role = aiEmployees.find((item) => item.id === input.employee)!;
  const ruleBlock =
    input.ruleTexts && input.ruleTexts.length > 0
      ? ['Project task rules you must follow:', ...input.ruleTexts.map((rule, index) => `${index + 1}. ${rule}`)].join(
          '\n'
        )
      : null;
  const basePrompt = [
    `You are ${role.name} assisting on the Nucleas project "${input.projectName}".`,
    role.description,
    `This project has about ${context.recentObjectiveCount} recent objectives and ${context.recentRunCount} recent AI runs recorded in Nucleas.`,
    'Reply helpfully and briefly. Do not claim to have changed project data or completed tasks outside this chat.',
    interactionMode === 'plan'
      ? 'Do not call tools in this turn.'
      : 'You may call provided tools (web_search, web_fetch, browser_navigate when available, image_generate). Never claim browse or image results without tool output.',
    interactionMode === 'plan'
      ? ''
      : 'Prefer web_search/web_fetch; use browser_navigate only when fetch is thin or JS rendering is required.',
    'If you lack information or tools, say what is missing instead of inventing project or web facts.',
    ...(ruleBlock ? [ruleBlock] : []),
  ]
    .filter(Boolean)
    .join(' ');

  const turn = await attemptCompanyCredentialChat({
    systemPrompt: appendInteractionModePrompt(basePrompt, interactionMode),
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    userText: input.userText,
    priorTurns: input.priorTurns,
    modelProfileId: workerProfileId,
    model: workerModel,
    includeImageTool: interactionMode !== 'plan',
    forcePlain: shouldForcePlainChat(interactionMode),
    signal: input.signal,
  });

  if (interactionMode === 'plan' && turn.role === 'assistant') {
    const parsed = parseNucleasPlan(turn.text);
    if (parsed) {
      return { ...turn, text: parsed.displayText, plan: parsed.plan };
    }
  }
  return turn;
}
