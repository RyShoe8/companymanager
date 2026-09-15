import 'server-only';
import type { ClientSession } from 'mongoose';
import type { GatewayConfiguration } from '@nucleas/ai-core/gateway';
import { GatewayError, validateGatewayConfiguration } from '@nucleas/ai-core/gateway';
import { digestValue, PLANNING_PROMPT_VERSION } from '@nucleas/ai-core/planning';
import { readPlatformSettings, readBudgetSettings, fenceSettings, platformSettingsId, budgetSettingsId } from './settings';

export async function isAiPlanningEnabled(): Promise<boolean> {
  return (await readPlatformSettings()).value.planningEnabled;
}

export async function getPlanningPolicy(organizationId: string, projectId: string, session?: ClientSession) {
  const platform = await readPlatformSettings(session);
  const organization = await readBudgetSettings(organizationId, undefined, session);
  const project = await readBudgetSettings(organizationId, projectId, session);
  const settings = platform.value;
  if (organization.value.paused || project.value.paused) throw new GatewayError('configuration');
  if (!settings.planningEnabled || !settings.dispatchEnabled || !settings.remoteEnabled || !process.env.CRON_SECRET?.trim()) throw new GatewayError('configuration');
  const gateway: GatewayConfiguration = {
    endpoint: settings.endpoint, model: settings.model, protocol: settings.protocol,
    bearerToken: process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN ?? '', timeoutMs: 120000,
  };
  validateGatewayConfiguration(gateway);
  const organizationLimitMicros = Math.min(settings.organizationLimitMicros, organization.value.limitMicros ?? settings.organizationLimitMicros);
  const projectLimitMicros = Math.min(settings.projectLimitMicros, organizationLimitMicros, project.value.limitMicros ?? settings.projectLimitMicros);
  if (settings.reservationMicros <= 0 || settings.reservationMicros > projectLimitMicros) throw new GatewayError('configuration');
  if (session) {
    await fenceSettings(platformSettingsId, platform.revision, session);
    await fenceSettings(budgetSettingsId(organizationId), organization.revision, session);
    await fenceSettings(budgetSettingsId(organizationId, projectId), project.revision, session);
  }
  const policy = { endpoint: gateway.endpoint, model: gateway.model, protocol: gateway.protocol,
    reservationMicros: settings.reservationMicros, organizationLimitMicros, projectLimitMicros,
    noProviderFee: settings.noProviderFee, promptVersion: PLANNING_PROMPT_VERSION,
    dailyRequestLimit: settings.dailyRequestLimit, minimumIntervalSeconds: settings.minimumIntervalSeconds,
    maxOutputTokens: settings.maxOutputTokens,
    revisions: [platform.revision, organization.revision, project.revision],
  };
  return { gateway, ...policy, digest: digestValue(policy) };
}

/** User-initiated team chat: shared remote/dispatch/budget gates without planning queue or cron. */
export async function getChatInferencePolicy(organizationId: string, projectId: string, session?: ClientSession) {
  const platform = await readPlatformSettings(session);
  const organization = await readBudgetSettings(organizationId, undefined, session);
  const project = await readBudgetSettings(organizationId, projectId, session);
  const settings = platform.value;
  if (organization.value.paused || project.value.paused) throw new GatewayError('configuration');
  if (!settings.remoteEnabled) throw new GatewayError('configuration');
  if (!settings.dispatchEnabled) throw new GatewayError('configuration');
  if (!process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN?.trim()) throw new GatewayError('credentials');
  const gateway: GatewayConfiguration = {
    endpoint: settings.endpoint,
    model: settings.model,
    protocol: settings.protocol,
    bearerToken: process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN ?? '',
    timeoutMs: 20000,
  };
  validateGatewayConfiguration(gateway);
  const organizationLimitMicros = Math.min(
    settings.organizationLimitMicros,
    organization.value.limitMicros ?? settings.organizationLimitMicros
  );
  const projectLimitMicros = Math.min(
    settings.projectLimitMicros,
    organizationLimitMicros,
    project.value.limitMicros ?? settings.projectLimitMicros
  );
  if (settings.reservationMicros <= 0 || settings.reservationMicros > projectLimitMicros) {
    throw new GatewayError('configuration');
  }
  if (session) {
    await fenceSettings(platformSettingsId, platform.revision, session);
    await fenceSettings(budgetSettingsId(organizationId), organization.revision, session);
    await fenceSettings(budgetSettingsId(organizationId, projectId), project.revision, session);
  }
  const policy = {
    endpoint: gateway.endpoint,
    model: gateway.model,
    protocol: gateway.protocol,
    reservationMicros: settings.reservationMicros,
    organizationLimitMicros,
    projectLimitMicros,
    noProviderFee: settings.noProviderFee,
    dailyRequestLimit: settings.dailyRequestLimit,
    minimumIntervalSeconds: settings.minimumIntervalSeconds,
    maxOutputTokens: settings.maxOutputTokens,
    revisions: [platform.revision, organization.revision, project.revision],
  };
  return { gateway, ...policy, digest: digestValue(policy) };
}

/** Role-pipeline stages: budget/dispatch gates without requiring the legacy env bearer. */
export async function getPipelineInferencePolicy(
  organizationId: string,
  projectId: string,
  session?: ClientSession,
  options?: { requirePositiveReservation?: boolean }
) {
  const platform = await readPlatformSettings(session);
  const organization = await readBudgetSettings(organizationId, undefined, session);
  const project = await readBudgetSettings(organizationId, projectId, session);
  const settings = platform.value;
  if (organization.value.paused || project.value.paused) throw new GatewayError('configuration');
  if (!settings.remoteEnabled) throw new GatewayError('configuration');
  if (!settings.dispatchEnabled) throw new GatewayError('configuration');
  const organizationLimitMicros = Math.min(
    settings.organizationLimitMicros,
    organization.value.limitMicros ?? settings.organizationLimitMicros
  );
  const projectLimitMicros = Math.min(
    settings.projectLimitMicros,
    organizationLimitMicros,
    project.value.limitMicros ?? settings.projectLimitMicros
  );
  const requirePositiveReservation = options?.requirePositiveReservation !== false;
  if (
    requirePositiveReservation &&
    (settings.reservationMicros <= 0 || settings.reservationMicros > projectLimitMicros)
  ) {
    throw new GatewayError('configuration');
  }
  if (session) {
    await fenceSettings(platformSettingsId, platform.revision, session);
    await fenceSettings(budgetSettingsId(organizationId), organization.revision, session);
    await fenceSettings(budgetSettingsId(organizationId, projectId), project.revision, session);
  }
  const policy = {
    reservationMicros: Math.max(0, settings.reservationMicros),
    organizationLimitMicros,
    projectLimitMicros,
    noProviderFee: settings.noProviderFee,
    dailyRequestLimit: settings.dailyRequestLimit,
    minimumIntervalSeconds: settings.minimumIntervalSeconds,
    maxOutputTokens: settings.maxOutputTokens,
    revisions: [platform.revision, organization.revision, project.revision],
  };
  return { ...policy, digest: digestValue(policy) };
}

export async function planningAvailability(organizationId: string, projectId: string) {
  try { const policy = await getPlanningPolicy(organizationId, projectId); return { enabled: true, model: policy.model, reservationMicros: policy.reservationMicros }; }
  catch { return { enabled: false, model: null, reservationMicros: null }; }
}
