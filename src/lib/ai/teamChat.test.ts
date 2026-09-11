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
  return {
    AiObjective: { find: vi.fn(chain) },
    AiRun: { find: vi.fn(chain) },
  };
});

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

describe('attemptTeamChatReply', () => {
  beforeEach(() => {
    vi.resetModules();
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
      userText: 'Hello',
      priorTurns: [],
    });
    expect(turn).toMatchObject({
      role: 'status',
      failureCategory: 'unavailable',
    });
    expect(turn.text).toMatch(/disabled/i);
  });

  it('blocks ungoverned inference even when remote credentials are configured', async () => {
    process.env.NUCLEAS_AI_REMOTE_BEARER_TOKEN = 'synthetic-token';
    const enabled = { ...platformValue, remoteEnabled: true };
    const { readSettings, readPlatformSettings } = await import('@/lib/ai/control/settings');
    const { invokeModel } = await import('@nucleas/ai-core/gateway');
    vi.mocked(readSettings).mockResolvedValue({ revision: 1, value: enabled });
    vi.mocked(readPlatformSettings).mockResolvedValue({ revision: 1, value: enabled } as never);
    vi.mocked(invokeModel).mockResolvedValue({
      content: 'OK from model',
      model: 'test-model',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 10,
      finishReason: 'stop',
    });

    const { attemptTeamChatReply } = await import('./teamChat');
    const turn = await attemptTeamChatReply({
      employee: 'support',
      projectName: 'Demo',
      organizationId: 'org-1',
      projectId,
      userText: 'Hello',
      priorTurns: [{ role: 'user', text: 'Earlier' }],
    });
    expect(turn).toMatchObject({ role: 'status', failureCategory: 'unavailable' });
    expect(turn.text).toMatch(/budget reservations/);
    expect(invokeModel).not.toHaveBeenCalled();
  });
});
