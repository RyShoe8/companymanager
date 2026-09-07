import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { isManagerOrAdminRole } from '@/lib/utils/roles';
import { AiHttpError, requireAiProject } from './access';
import { budgetSettingsId, fenceSettings, platformSettingsId, readBudgetSettings, readPlatformSettings, saveSettings } from './settings';
import { aiTransaction } from './transaction';
import { aiBudgetSettingsSchema } from '@/lib/ai/settingsSchema';
import { AiBudget } from '@/lib/models/AiControl';

export async function requireBudgetAccess(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined;
  if (projectId) {
    const access = await requireAiProject(request, projectId, true, true);
    return { userId: access.userId, organizationId: access.organizationId, projectId };
  }
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) throw new AiHttpError(401, 'Sign in to continue.');
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) throw new AiHttpError(403, 'Invalid request origin.');
  await connectDB();
  const user = await User.findById(auth.userId).select('organizationId').lean();
  if (!user?.organizationId) throw new AiHttpError(403, 'Organization required.');
  const employee = await Employee.findOne({ userId: auth.userId, organizationId: user.organizationId }).select('role').lean();
  if (!isManagerOrAdminRole(employee?.role)) throw new AiHttpError(403, 'An organization manager or administrator is required.');
  return { userId: auth.userId, organizationId: user.organizationId, projectId: undefined };
}
export async function budgetSettingsView(organizationId: string, projectId?: string) {
  const platform = await readPlatformSettings();
  const organization = await readBudgetSettings(organizationId);
  const settings = projectId ? await readBudgetSettings(organizationId, projectId) : organization;
  const ceilingMicros = projectId ? Math.min(platform.value.projectLimitMicros, platform.value.organizationLimitMicros,
    organization.value.limitMicros ?? platform.value.organizationLimitMicros) : platform.value.organizationLimitMicros;
  const effectiveLimitMicros = Math.min(settings.value.limitMicros ?? ceilingMicros, ceilingMicros);
  const asOf = new Date();
  const period = asOf.toISOString().slice(0, 7);
  const ledger = await AiBudget.findOne({ organizationId, scopeKey: projectId ? `project:${projectId}` : 'organization', period })
    .select('spentMicros reservedMicros -_id').maxTimeMS(3000).lean();
  const spentMicros = ledger?.spentMicros ?? 0;
  const reservedMicros = ledger?.reservedMicros ?? 0;
  return { settings, ceilingMicros, effectiveLimitMicros,
    usage: { period, asOf: asOf.toISOString(), ledgerExists: !!ledger, spentMicros, reservedMicros,
      remainingMicros: Math.max(0, effectiveLimitMicros - spentMicros - reservedMicros) },
    parentPaused: !platform.value.planningEnabled || !platform.value.remoteEnabled || !platform.value.dispatchEnabled || (projectId ? organization.value.paused : false),
    reservationMicros: platform.value.reservationMicros, scope: projectId ? 'project' : 'organization' };
}
export async function saveBudgetSettings(access: Awaited<ReturnType<typeof requireBudgetAccess>>, revision: number, value: unknown) {
  const parsed = aiBudgetSettingsSchema.parse(value);
  return aiTransaction(async session => {
    const platform = await readPlatformSettings(session);
    const organization = await readBudgetSettings(access.organizationId, undefined, session);
    const ceiling = access.projectId ? Math.min(platform.value.projectLimitMicros, platform.value.organizationLimitMicros,
      organization.value.limitMicros ?? platform.value.organizationLimitMicros) : platform.value.organizationLimitMicros;
    if (parsed.limitMicros !== null && parsed.limitMicros > ceiling) throw new AiHttpError(400, 'Budget exceeds the current parent ceiling.');
    await fenceSettings(platformSettingsId, platform.revision, session);
    if (access.projectId) await fenceSettings(budgetSettingsId(access.organizationId), organization.revision, session);
    const saved = await saveSettings(budgetSettingsId(access.organizationId, access.projectId), revision, parsed, access.userId, session);
    if (!saved) throw new AiHttpError(409, 'Budget settings changed. Reload before saving again.');
    return saved;
  });
}
