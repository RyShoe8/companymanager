import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/ai/control/settings', () => ({
  readPlatformSettings: vi.fn(),
  readSettings: vi.fn(),
  platformSettingsId: 'platform-v1',
}));

vi.mock('@/lib/models/AiControl', () => {
  const chain = () => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          maxTimeMS: () => ({
            lean: async () => [],
          }),
        }),
      }),
    }),
  });
  const withSession = (value: unknown) => {
    const result = Promise.resolve(value);
    return Object.assign(result, { session: () => result });
  };
  const runId = { toString: () => 'aaaaaaaaaaaaaaaaaaaaaaaa' };
  return {
    AiObjective: { find: vi.fn(chain) },
    AiRun: {
      find: vi.fn(chain),
      create: vi.fn(async () => [{ _id: runId }]),
      updateOne: vi.fn(() => withSession({})),
      findOneAndUpdate: vi.fn(() => withSession({ _id: runId, revision: 2 })),
      exists: vi.fn(() => withSession(true)),
    },
    AiBudget: {
      findOneAndUpdate: vi.fn(() => withSession({ _id: { toString: () => 'bbbbbbbbbbbbbbbbbbbbbbbb' } })),
    },
    AiDispatchLock: {
      findById: vi.fn(() => withSession(null)),
      updateOne: vi.fn(() => withSession({})),
      deleteOne: vi.fn(() => {
        const result = Promise.resolve({});
        return Object.assign(result, {
          session: () => result,
          catch: (fn: () => void) => result.catch(fn),
        });
      }),
    },
    AiRunEvent: { create: vi.fn(async () => []) },
  };
});

vi.mock('@/lib/ai/control/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/control/config')>();
  return {
    ...actual,
    getChatInferencePolicy: vi.fn(),
  };
});

vi.mock('@/lib/ai/control/budgets', () => ({
  reserveRunBudget: vi.fn(),
  settleRunBudget: vi.fn(),
}));

vi.mock('@/lib/ai/control/dispatchLimits', () => ({
  DISPATCH_USAGE_ID: 'remote-planning-v1',
  reserveDispatch: vi.fn(),
}));

vi.mock('@/lib/ai/control/transaction', () => ({
  aiTransaction: async (work: (session: unknown) => Promise<unknown>) => work({}),
}));

vi.mock('@nucleas/ai-core/gateway', async () => {
  const actual = await vi.importActual<typeof import('@nucleas/ai-core/gateway')>('@nucleas/ai-core/gateway');
  return {
    ...actual,
    invokeModel: vi.fn(),
  };
});

const platformValue = {
  planningEnabled: true,
  remoteEnabled: false,
  dispatchEnabled: false,
  protocol: 'openai-chat' as const,
  endpoint: 'https://llm.rogly.net/v1/chat/completions',
  model: 'test-model',
  noProviderFee: false,
  reservationMicros: 0,
  organizationLimitMicros: 0,
  projectLimitMicros: 0,
  dailyRequestLimit: 48,
  minimumIntervalSeconds: 300,
  maxOutputTokens: 2048,
};

const projectId = new Types.ObjectId();
const userId = new Types.ObjectId().toString();

describe('attemptTeamChatReply', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns a status turn when remote inference is disabled', async () => {
    const { readSettings, readPlatformSettings } = await import('@/lib/ai/control/settings');
    vi.mocked(readSettings).mockResolvedValue({ revision: 1, value: platformValue });
    vi.mocked(readPlatformSettings).mockResolvedValue({ revision: 1, value: platformValue } as never);

    const { attemptTeamChatReply } = await import('./teamChat');
    const turn = await attemptTeamChatReply({
      employee: 'product',
      projectName: 'Demo',
      organizationId: 'org-1',
      projectId,
      userId,
      userText: 'Hello',
      priorTurns: [],
    });
    expect(turn).toMatchObject({
      role: 'status',
      failureCategory: 'unavailable',
    });
    expect(turn.text).toMatch(/disabled/i);
  });

  it('returns a status turn when processing is paused', async () => {
    process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN = 'synthetic-token';
    const enabled = { ...platformValue, remoteEnabled: true, dispatchEnabled: false, reservationMicros: 25, organizationLimitMicros: 100, projectLimitMicros: 75 };
    const { readSettings, readPlatformSettings } = await import('@/lib/ai/control/settings');
    const { invokeModel } = await import('@nucleas/ai-core/gateway');
    vi.mocked(readSettings).mockResolvedValue({ revision: 1, value: enabled });
    vi.mocked(readPlatformSettings).mockResolvedValue({ revision: 1, value: enabled } as never);

    const { attemptTeamChatReply } = await import('./teamChat');
    const turn = await attemptTeamChatReply({
      employee: 'researcher',
      projectName: 'Demo',
      organizationId: 'org-1',
      projectId,
      userId,
      userText: 'Hello',
      priorTurns: [],
    });
    expect(turn).toMatchObject({ role: 'status', failureCategory: 'unavailable' });
    expect(turn.text).toMatch(/processing/i);
    expect(invokeModel).not.toHaveBeenCalled();
  });

  it('does not call the model when budgets block chat admission', async () => {
    process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN = 'synthetic-token';
    const enabled = {
      ...platformValue,
      remoteEnabled: true,
      dispatchEnabled: true,
      reservationMicros: 25,
      organizationLimitMicros: 100,
      projectLimitMicros: 75,
    };
    const { GatewayError } = await import('@nucleas/ai-core/gateway');
    const { readSettings, readPlatformSettings } = await import('@/lib/ai/control/settings');
    const { getChatInferencePolicy } = await import('@/lib/ai/control/config');
    const { invokeModel } = await import('@nucleas/ai-core/gateway');
    vi.mocked(readSettings).mockResolvedValue({ revision: 1, value: enabled });
    vi.mocked(readPlatformSettings).mockResolvedValue({ revision: 1, value: enabled } as never);
    vi.mocked(getChatInferencePolicy).mockRejectedValue(new GatewayError('configuration'));

    const { attemptTeamChatReply } = await import('./teamChat');
    const turn = await attemptTeamChatReply({
      employee: 'support',
      projectName: 'Demo',
      organizationId: 'org-1',
      projectId,
      userId,
      userText: 'Hello',
      priorTurns: [],
    });
    expect(turn).toMatchObject({ role: 'status', failureCategory: 'unavailable' });
    expect(turn.text).toMatch(/reservation|budget/i);
    expect(invokeModel).not.toHaveBeenCalled();
  });
});
