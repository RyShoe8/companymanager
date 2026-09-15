import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { GatewayError } from '@nucleas/ai-core/gateway';

const runId = new Types.ObjectId();

const mocks = vi.hoisted(() => ({
  gatewayFromProfile: vi.fn(),
  getPolicy: vi.fn(),
  transaction: vi.fn(),
  toolLoop: vi.fn(),
  invokeModel: vi.fn(),
  settle: vi.fn(),
  decrementFree: vi.fn(),
  reserveDispatch: vi.fn(),
  reserveBudget: vi.fn(),
  findLock: vi.fn(),
  updateLock: vi.fn(),
  deleteLock: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  findUpdateRun: vi.fn(),
  createEvent: vi.fn(),
  findBudget: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/rolePipeline/profiles', () => ({ gatewayFromModelProfile: mocks.gatewayFromProfile }));
vi.mock('@/lib/ai/control/config', () => ({ getPipelineInferencePolicy: mocks.getPolicy }));
vi.mock('@/lib/ai/control/transaction', () => ({ aiTransaction: mocks.transaction }));
vi.mock('@/lib/ai/control/budgets', () => ({
  reserveRunBudget: mocks.reserveBudget,
  settleRunBudget: mocks.settle,
}));
vi.mock('@/lib/ai/control/freePool', () => ({ decrementFreePoolRemaining: mocks.decrementFree }));
vi.mock('@/lib/ai/control/dispatchLimits', () => ({
  DISPATCH_USAGE_ID: 'dispatch',
  reserveDispatch: mocks.reserveDispatch,
}));
vi.mock('@/lib/ai/tools/runToolLoop', () => ({ runIdeToolLoop: mocks.toolLoop }));
vi.mock('@nucleas/ai-core/gateway', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nucleas/ai-core/gateway')>();
  return { ...actual, invokeModel: mocks.invokeModel };
});
vi.mock('@/lib/models/AiControl', () => ({
  AiBudget: { findOneAndUpdate: (...args: unknown[]) => mocks.findBudget(...args) },
  AiDispatchLock: {
    findById: (...args: unknown[]) => mocks.findLock(...args),
    updateOne: (...args: unknown[]) => mocks.updateLock(...args),
    deleteOne: (...args: unknown[]) => mocks.deleteLock(...args),
  },
  AiRun: {
    create: (...args: unknown[]) => mocks.createRun(...args),
    updateOne: (...args: unknown[]) => mocks.updateRun(...args),
    findOneAndUpdate: (...args: unknown[]) => mocks.findUpdateRun(...args),
  },
  AiRunEvent: { create: (...args: unknown[]) => mocks.createEvent(...args) },
}));

import { attemptCompanyCredentialChat } from '@/lib/ai/companyChat';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reserveDispatch.mockResolvedValue(true);
  mocks.reserveBudget.mockResolvedValue(undefined);
  mocks.settle.mockResolvedValue(undefined);
  mocks.decrementFree.mockResolvedValue(undefined);
  mocks.findLock.mockImplementation(() => {
    const p = Promise.resolve(null);
    return Object.assign(p, { session: () => Promise.resolve(null) });
  });
  mocks.updateLock.mockResolvedValue({});
  mocks.deleteLock.mockImplementation(() => Promise.resolve({}));
  mocks.createRun.mockResolvedValue([{ _id: runId }]);
  mocks.updateRun.mockResolvedValue({});
  mocks.findUpdateRun.mockResolvedValue({ _id: runId, revision: 1 });
  mocks.createEvent.mockResolvedValue([]);
  mocks.findBudget.mockResolvedValue({ _id: new Types.ObjectId() });
  mocks.gatewayFromProfile.mockResolvedValue({
    gateway: {
      endpoint: 'https://rogly.example/v1/chat/completions',
      bearerToken: 'tok',
      model: 'local',
      protocol: 'openai-chat',
    },
    profile: { provider: 'custom', tier: 'local_remote' },
  });
  mocks.getPolicy.mockResolvedValue({
    reservationMicros: 0,
    organizationLimitMicros: 100,
    projectLimitMicros: 75,
    noProviderFee: true,
    dailyRequestLimit: 100,
    minimumIntervalSeconds: 1,
    maxOutputTokens: 1024,
    digest: 'd',
  });
  mocks.transaction.mockImplementation(async (work: (session: unknown) => Promise<unknown>) =>
    work({})
  );
});

describe('attemptCompanyCredentialChat free plain fallback', () => {
  it('retries plain invokeModel when tools fail on a free credential', async () => {
    mocks.toolLoop.mockRejectedValue(new GatewayError('unavailable'));
    mocks.invokeModel.mockResolvedValue({
      content: 'plain reply',
      model: 'local',
      inputTokens: 1,
      outputTokens: 2,
      latencyMs: 5,
      finishReason: 'stop',
    });

    const turn = await attemptCompanyCredentialChat({
      systemPrompt: 'You are helpful.',
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userId: 'a'.repeat(24),
      userText: 'hello',
      priorTurns: [],
      modelProfileId: 'b'.repeat(24),
      model: 'local',
    });

    expect(mocks.toolLoop).toHaveBeenCalled();
    expect(mocks.invokeModel).toHaveBeenCalled();
    expect(turn).toMatchObject({ role: 'assistant', text: 'plain reply', noProviderFee: true });
  });

  it('does not plain-retry for paid credentials', async () => {
    mocks.gatewayFromProfile.mockResolvedValue({
      gateway: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        bearerToken: 'tok',
        model: 'gpt',
        protocol: 'openai-chat',
      },
      profile: { provider: 'openai', tier: 'commercial' },
    });
    mocks.getPolicy.mockResolvedValue({
      reservationMicros: 25,
      organizationLimitMicros: 100,
      projectLimitMicros: 75,
      noProviderFee: false,
      dailyRequestLimit: 100,
      minimumIntervalSeconds: 1,
      maxOutputTokens: 1024,
      digest: 'd',
    });
    mocks.toolLoop.mockRejectedValue(new GatewayError('unavailable'));

    const turn = await attemptCompanyCredentialChat({
      systemPrompt: 'You are helpful.',
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userId: 'a'.repeat(24),
      userText: 'hello',
      priorTurns: [],
      modelProfileId: 'b'.repeat(24),
      model: 'gpt',
    });

    expect(mocks.toolLoop).toHaveBeenCalled();
    expect(mocks.invokeModel).not.toHaveBeenCalled();
    expect(turn).toMatchObject({
      role: 'status',
      failureCategory: 'unavailable',
    });
  });
});
