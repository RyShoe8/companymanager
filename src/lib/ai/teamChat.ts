import 'server-only';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { GatewayError, invokeModel, validateGatewayConfiguration, type GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { readPlatformSettings, readSettings, platformSettingsId } from '@/lib/ai/control/settings';
import { defaultPlatformAiSettings, platformAiSettingsSchema } from '@/lib/ai/settingsSchema';
import { classifyProbeFailure } from '@/lib/ai/probeDiagnostics';
import { AiObjective, AiRun } from '@/lib/models/AiControl';
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
};

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
  if (!process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN?.trim()) {
    return unavailableContext(
      projectName,
      'Remote credentials are not configured on the server.',
      settings,
      counts
    );
  }
  try {
    validateGatewayConfiguration({
      endpoint: settings.endpoint,
      model: settings.model,
      protocol: settings.protocol,
      bearerToken: process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN ?? '',
      timeoutMs: 20000,
    });
  } catch {
    return unavailableContext(projectName, 'Remote endpoint configuration is invalid.', settings, counts);
  }
  return {
    projectName,
    inferenceReady: true,
    remoteEnabled: settings.remoteEnabled,
    planningEnabled: settings.planningEnabled,
    unavailableReason: null,
    included: [
      `Project name: ${projectName}`,
      'Selected AI employee role preset',
      'Recent private thread turns for this employee',
      `Recent objectives in project: ${counts.recentObjectiveCount}${counts.recentObjectiveCount >= 25 ? '+' : ''}`,
      `Recent AI runs in project: ${counts.recentRunCount}${counts.recentRunCount >= 25 ? '+' : ''}`,
      'Repository files are not included in team chat',
    ],
    ...counts,
  };
}

function gatewayFromSettings(settings: {
  endpoint: string; model: string; protocol: 'openai-chat'; maxOutputTokens: number;
}): GatewayConfiguration {
  return {
    endpoint: settings.endpoint,
    model: settings.model,
    protocol: settings.protocol,
    bearerToken: process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN ?? '',
    timeoutMs: 20000,
  };
}

/** Attempt a real gateway chat reply. Never invents assistant content on failure. */
export async function attemptTeamChatReply(input: {
  employee: AiEmployeeKey;
  projectName: string;
  organizationId: string;
  projectId: Types.ObjectId;
  userText: string;
  priorTurns: { role: TeamMessageRole; text: string }[];
}): Promise<TeamChatTurn> {
  const context = await buildTeamContextSummary(input.projectName, input.organizationId, input.projectId);
  const requestId = randomUUID();
  if (!context.inferenceReady) {
    return {
      requestId,
      role: 'status',
      text: context.unavailableReason ?? 'Inference is unavailable.',
      failureCategory: 'unavailable',
    };
  }

  const platform = await readPlatformSettings();
  const settings = platform.value;
  const role = aiEmployees.find((item) => item.id === input.employee)!;
  const gateway = gatewayFromSettings(settings);
  validateGatewayConfiguration(gateway);

  const history = input.priorTurns
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .slice(-8)
    .map((turn) => ({ role: turn.role as 'user' | 'assistant', content: turn.text.slice(0, 2000) }));

  const messages = [
    {
      role: 'system' as const,
      content: [
        `You are ${role.name} assisting on the Nucleas project "${input.projectName}".`,
        role.description,
        `This project has about ${context.recentObjectiveCount} recent objectives and ${context.recentRunCount} recent AI runs recorded in Nucleas.`,
        'Reply helpfully and briefly. Do not claim to have changed project data, run code, or completed tasks outside this chat.',
        'If you lack information, say what is missing instead of inventing project facts.',
      ].join(' '),
    },
    ...history,
    { role: 'user' as const, content: input.userText.slice(0, 6000) },
  ];

  try {
    const result = await invokeModel(gateway, {
      role: 'architect',
      messages,
      maxOutputTokens: Math.min(512, settings.maxOutputTokens),
    });
    const content = result.content.trim().slice(0, 6000);
    if (!content) {
      return {
        requestId,
        role: 'status',
        text: 'The model returned an empty reply. No assistant content was stored.',
        failureCategory: 'invalid_response',
      };
    }
    return { requestId, role: 'assistant', text: content };
  } catch (error) {
    if (error instanceof GatewayError) {
      const messagesByCode: Record<GatewayError['code'], string> = {
        configuration: 'Remote inference is not configured for team chat.',
        credentials: 'Remote authentication was rejected.',
        rate_limit: 'The remote provider rate-limited this request.',
        unavailable: 'The remote model endpoint was unreachable or returned an error.',
        invalid_response: 'The remote response could not be validated.',
        cancelled: 'The chat request was cancelled before completion.',
      };
      return {
        requestId,
        role: 'status',
        text: messagesByCode[error.code],
        failureCategory: error.code,
      };
    }
    return {
      requestId,
      role: 'status',
      text: 'The chat request failed before a model reply was received.',
      failureCategory: classifyProbeFailure(error),
    };
  }
}
