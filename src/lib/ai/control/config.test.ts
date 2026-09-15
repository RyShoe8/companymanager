import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPlatformAiSettings } from '@/lib/ai/settingsSchema';
const mocks = vi.hoisted(() => ({ platform: vi.fn(), budget: vi.fn(), fence: vi.fn() }));
vi.mock('./settings', () => ({ readPlatformSettings: mocks.platform, readBudgetSettings: mocks.budget,
  fenceSettings: mocks.fence, platformSettingsId: 'platform-v1', budgetSettingsId: (org: string, project?: string) => org + (project ?? '') }));
import { getPlanningPolicy, getPipelineInferencePolicy, isAiPlanningEnabled } from './config';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.platform.mockResolvedValue({ revision: 0, value: { ...defaultPlatformAiSettings, remoteEnabled: true, dispatchEnabled: true,
    reservationMicros: 25, organizationLimitMicros: 100, projectLimitMicros: 75 } });
  mocks.budget.mockResolvedValue({ revision: 0, value: { limitMicros: null } });
  vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', 'synthetic');
  vi.stubEnv('CRON_SECRET', 'synthetic-cron');
});
afterEach(() => vi.unstubAllEnvs());
describe('database-backed planning policy', () => {
  it.each(['organization', 'project'])('blocks a paused %s scope', async scope => {
    mocks.budget.mockImplementation(async (_org: string, project?: string) => ({ revision: 1,
      value: { limitMicros: null, paused: scope === 'project' ? !!project : !project } }));
    await expect(getPlanningPolicy('org', 'project')).rejects.toThrow();
  });
  it('enables planning for every organization without environment flags', async () => {
    vi.stubEnv('NUCLEAS_AI_PLANNING_ENABLED', 'false');
    expect(await isAiPlanningEnabled()).toBe(true);
    expect((await getPlanningPolicy('org-a', 'project-a')).organizationLimitMicros).toBe(100);
    expect((await getPlanningPolicy('org-b', 'project-b')).organizationLimitMicros).toBe(100);
  });
  it.each(['planningEnabled', 'remoteEnabled', 'dispatchEnabled'])('fails closed when %s is disabled in settings', async key => {
    const settings = await mocks.platform(); settings.value[key] = false;
    await expect(getPlanningPolicy('org', 'project')).rejects.toThrow();
  });
  it.each(['CRON_SECRET', 'NUCLEAS_AI_REMOTE_BEARER_TOKEN'])('requires the server secret %s', async key => {
    vi.stubEnv(key, ''); await expect(getPlanningPolicy('org', 'project')).rejects.toThrow();
  });
  it('clamps stored budget overrides to current parent ceilings', async () => {
    mocks.budget.mockImplementation(async (_org: string, project?: string) => ({ revision: 0, value: { limitMicros: project ? 1000 : 50 } }));
    expect(await getPlanningPolicy('org', 'project')).toMatchObject({ organizationLimitMicros: 50, projectLimitMicros: 50 });
  });
  it('blocks new calls at zero or below the reservation', async () => {
    mocks.budget.mockResolvedValue({ revision: 0, value: { limitMicros: 0 } });
    await expect(getPlanningPolicy('org', 'project')).rejects.toThrow();
  });
  it('invalidates jobs after saved policy revisions but not credential rotation', async () => {
    const digest = (await getPlanningPolicy('org', 'project')).digest;
    vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', 'rotated');
    expect((await getPlanningPolicy('org', 'project')).digest).toBe(digest);
    (await mocks.platform()).revision++;
    expect((await getPlanningPolicy('org', 'project')).digest).not.toBe(digest);
  });
});

describe('pipeline inference policy reservation', () => {
  it('allows free/local admission when reservationMicros is zero', async () => {
    mocks.platform.mockResolvedValue({
      revision: 0,
      value: {
        ...defaultPlatformAiSettings,
        remoteEnabled: true,
        dispatchEnabled: true,
        reservationMicros: 0,
        organizationLimitMicros: 100,
        projectLimitMicros: 75,
      },
    });
    await expect(
      getPipelineInferencePolicy('org', 'project', undefined, { requirePositiveReservation: false })
    ).resolves.toMatchObject({ reservationMicros: 0 });
  });

  it('still requires a positive reservation for paid credentials by default', async () => {
    mocks.platform.mockResolvedValue({
      revision: 0,
      value: {
        ...defaultPlatformAiSettings,
        remoteEnabled: true,
        dispatchEnabled: true,
        reservationMicros: 0,
        organizationLimitMicros: 100,
        projectLimitMicros: 75,
      },
    });
    await expect(getPipelineInferencePolicy('org', 'project')).rejects.toThrow();
  });
});
