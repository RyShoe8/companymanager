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
  reserveBudget: vi.fn(),
  findLock: vi.fn(),
  updateLock: vi.fn(),
  deleteLock: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  findUpdateRun: vi.fn(),
  createEvent: vi.fn(),
  findBudget: vi.fn(),
  webSearch: vi.fn(),
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
}));
vi.mock('@/lib/ai/tools/runToolLoop', () => ({ runIdeToolLoop: mocks.toolLoop }));
vi.mock('@/lib/ai/tools/webSearch', () => ({ webSearch: mocks.webSearch }));
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
      timeoutMs: 120000,
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

describe('attemptCompanyCredentialChat free tools', () => {
  it('prefers plain invoke for free greetings without the tool loop', async () => {
    mocks.invokeModel.mockResolvedValue({
      content: 'plain hello',
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

    expect(mocks.toolLoop).not.toHaveBeenCalled();
    expect(mocks.invokeModel).toHaveBeenCalled();
    expect(turn).toMatchObject({ role: 'assistant', text: 'plain hello', noProviderFee: true });
  });

  it('uses the tool loop for free image-style asks', async () => {
    mocks.toolLoop.mockResolvedValue({
      content: 'drew something',
      toolCallsMade: ['image_generate'],
      artifacts: [],
      inputTokens: 1,
      outputTokens: 2,
      latencyMs: 5,
    });

    const turn = await attemptCompanyCredentialChat({
      systemPrompt: 'You are helpful.',
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userId: 'a'.repeat(24),
      userText: 'please generate an image of a cat',
      priorTurns: [],
      modelProfileId: 'b'.repeat(24),
      model: 'local',
    });

    expect(mocks.toolLoop).toHaveBeenCalled();
    expect(mocks.toolLoop.mock.calls[0]?.[0]).toMatchObject({ includeImageTool: true });
    expect(turn).toMatchObject({ role: 'assistant', text: 'drew something', noProviderFee: true });
  });

  it('falls back to plain when free plain-first fails and tools also fail', async () => {
    mocks.invokeModel
      .mockRejectedValueOnce(new GatewayError('invalid_response'))
      .mockResolvedValue({
        content: 'plain local reply',
        model: 'local',
        inputTokens: 1,
        outputTokens: 2,
        latencyMs: 5,
        finishReason: 'stop',
      });
    mocks.toolLoop.mockRejectedValue(new GatewayError('invalid_response'));

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
    expect(mocks.webSearch).not.toHaveBeenCalled();
    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'plain local reply',
      noProviderFee: true,
    });
  });

  it('prefers Nucleas web_search assist before the tool loop on factual lookups', async () => {
    mocks.webSearch.mockResolvedValue({
      query: 'who are the top 5 scorers for Arsenal all time?',
      note: 'Sparse.',
      hits: [{ title: 'Thierry Henry', url: 'https://example.com/h', snippet: '226 goals' }],
    });
    mocks.invokeModel.mockResolvedValue({
      content: 'Thierry Henry is Arsenal’s all-time top scorer.',
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
      userText: 'who are the top 5 scorers for Arsenal all time?',
      priorTurns: [],
      modelProfileId: 'b'.repeat(24),
      model: 'local',
    });

    expect(mocks.toolLoop).not.toHaveBeenCalled();
    expect(mocks.webSearch).toHaveBeenCalled();
    expect(mocks.invokeModel).toHaveBeenCalled();
    const invokeArg = mocks.invokeModel.mock.calls[0]?.[1] as {
      messages: { role: string; content: string }[];
    };
    const userMsg = invokeArg.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(userMsg).toMatch(/Web search results/);
    expect(userMsg).toMatch(/Thierry Henry/);
    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'Thierry Henry is Arsenal’s all-time top scorer.',
      toolsUsed: ['web_search'],
      noProviderFee: true,
    });
  });

  it('retries assist when tools fail with a non-GatewayError on a factual lookup', async () => {
    mocks.webSearch
      .mockRejectedValueOnce(new Error('search briefly unavailable'))
      .mockResolvedValue({
        query: 'who won the latest champions league final?',
        note: 'Sparse.',
        hits: [{ title: 'Final', url: 'https://example.com/f', snippet: 'Result' }],
      });
    mocks.invokeModel
      .mockRejectedValueOnce(new GatewayError('invalid_response'))
      .mockResolvedValue({
        content: 'Grounded from Nucleas search.',
        model: 'local',
        inputTokens: 1,
        outputTokens: 2,
        latencyMs: 5,
        finishReason: 'stop',
      });
    mocks.toolLoop.mockRejectedValue(new Error('unexpected tool schema'));

    const turn = await attemptCompanyCredentialChat({
      systemPrompt: 'You are helpful.',
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userId: 'a'.repeat(24),
      userText: 'who won the latest champions league final?',
      priorTurns: [],
      modelProfileId: 'b'.repeat(24),
      model: 'local',
    });

    expect(mocks.toolLoop).toHaveBeenCalled();
    expect(mocks.webSearch).toHaveBeenCalledTimes(2);
    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'Grounded from Nucleas search.',
      toolsUsed: ['web_search'],
      noProviderFee: true,
    });
    expect(turn.text).not.toMatch(/model call failed/i);
  });

  it('degrades to plain knowledge when Nucleas search throws on a lookup', async () => {
    mocks.webSearch.mockRejectedValue(new Error('ddg unavailable'));
    mocks.invokeModel.mockResolvedValue({
      content: 'Answer from model knowledge.',
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
      userText: 'who are the top 5 scorers for Arsenal all time?',
      priorTurns: [],
      modelProfileId: 'b'.repeat(24),
      model: 'local',
    });

    expect(mocks.toolLoop).not.toHaveBeenCalled();
    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'Answer from model knowledge.',
      noProviderFee: true,
    });
    expect(turn.text).not.toMatch(/model call failed/i);
  });

  it('retries plain invokeModel when free tools fail with a non-GatewayError', async () => {
    mocks.invokeModel
      .mockRejectedValueOnce(new GatewayError('invalid_response'))
      .mockResolvedValue({
        content: 'plain after unknown tool failure',
        model: 'local',
        inputTokens: 1,
        outputTokens: 2,
        latencyMs: 5,
        finishReason: 'stop',
      });
    mocks.toolLoop.mockRejectedValue(new Error('unexpected tool schema'));

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
    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'plain after unknown tool failure',
      noProviderFee: true,
    });
  });

  it('uses host-focused invalid_response copy when free tools and plain both fail', async () => {
    mocks.toolLoop.mockRejectedValue(new GatewayError('invalid_response'));
    mocks.invokeModel.mockRejectedValue(new GatewayError('invalid_response'));

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

    expect(turn).toMatchObject({
      role: 'status',
      failureCategory: 'invalid_response',
      noProviderFee: true,
    });
    expect(turn.debugHint).toMatch(/code=invalid_response/);
    expect(turn.text).toMatch(/invalid response/i);
    expect(turn.text).not.toMatch(/commercial/i);
    expect(turn.text).not.toMatch(/image generation/i);
  });

  it('uses clearer unavailable copy when the free host fails after tool retry', async () => {
    mocks.toolLoop.mockRejectedValue(new GatewayError('unavailable'));
    mocks.invokeModel.mockRejectedValue(new GatewayError('unavailable'));

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

    expect(turn).toMatchObject({
      role: 'status',
      failureCategory: 'unavailable',
    });
    expect(turn.text).toMatch(/Local\/free model host/);
    expect(turn.text).toMatch(/HTTPS/);
  });
});

describe('attemptCompanyCredentialChat commercial', () => {
  beforeEach(() => {
    mocks.gatewayFromProfile.mockResolvedValue({
      gateway: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        bearerToken: 'tok',
        model: 'gpt',
        protocol: 'openai-chat',
        timeoutMs: 60000,
      },
      profile: { provider: 'openai', tier: 'commercial' },
    });
    mocks.getPolicy.mockResolvedValue({
      reservationMicros: 25,
      organizationLimitMicros: 100,
      projectLimitMicros: 75,
      noProviderFee: true,
      dailyRequestLimit: 100,
      minimumIntervalSeconds: 1,
      maxOutputTokens: 1024,
      digest: 'd',
    });
  });

  it('ignores platform noProviderFee for commercial credentials', async () => {
    mocks.toolLoop.mockResolvedValue({
      content: 'paid reply',
      toolCallsMade: [],
      artifacts: [],
      inputTokens: 1,
      outputTokens: 2,
      latencyMs: 5,
    });

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

    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'paid reply',
      noProviderFee: false,
      reservedMicros: 25,
    });
  });

  it('retries plain invokeModel when the tool loop fails', async () => {
    mocks.toolLoop.mockRejectedValue(new GatewayError('unavailable'));
    mocks.invokeModel.mockResolvedValue({
      content: 'plain paid reply',
      model: 'gpt',
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
      model: 'gpt',
    });

    expect(mocks.toolLoop).toHaveBeenCalled();
    expect(mocks.invokeModel).toHaveBeenCalled();
    expect(turn).toMatchObject({
      role: 'assistant',
      text: 'plain paid reply',
      noProviderFee: false,
    });
  });

  it('surfaces unavailable when tools and plain both fail', async () => {
    mocks.toolLoop.mockRejectedValue(new GatewayError('unavailable'));
    mocks.invokeModel.mockRejectedValue(new GatewayError('unavailable'));

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

    expect(turn).toMatchObject({
      role: 'status',
      failureCategory: 'unavailable',
      text: 'The remote model endpoint was unreachable or returned an error.',
      noProviderFee: false,
    });
  });
});
