import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  companyChat: vi.fn(),
  repoDig: vi.fn(),
  findPipeline: vi.fn(),
  findObjectives: vi.fn(),
  findRuns: vi.fn(),
  readSettings: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/companyChat', () => ({
  attemptCompanyCredentialChat: (...args: unknown[]) => mocks.companyChat(...args),
}));
vi.mock('@/lib/models/AiRolePipeline', () => ({
  AiRolePipeline: {
    findOne: (...args: unknown[]) => mocks.findPipeline(...args),
  },
}));
vi.mock('@/lib/models/AiControl', () => ({
  AiBudget: {},
  AiDispatchLock: {},
  AiObjective: {
    find: (...args: unknown[]) => mocks.findObjectives(...args),
  },
  AiRun: {
    find: (...args: unknown[]) => mocks.findRuns(...args),
  },
  AiRunEvent: {},
}));
vi.mock('@/lib/ai/control/settings', () => ({
  readSettings: (...args: unknown[]) => mocks.readSettings(...args),
  platformSettingsId: () => 'platform',
}));
vi.mock('@/lib/ai/control/config', () => ({
  getChatInferencePolicy: vi.fn(),
  getPipelineInferencePolicy: vi.fn().mockResolvedValue({
    reservationMicros: 1000,
    organizationLimitMicros: 100000,
    projectLimitMicros: 50000,
  }),
}));
vi.mock('@/lib/ai/tools/serverRepoAssist', () => ({
  gatherRepoAssistContext: (...args: unknown[]) => mocks.repoDig(...args),
}));

import { attemptTeamChatReply } from '@/lib/ai/teamChat';

function leanChain(result: unknown) {
  return {
    select: () => ({
      sort: () => ({
        limit: () => ({
          maxTimeMS: () => ({
            lean: async () => result,
          }),
        }),
      }),
      maxTimeMS: () => ({
        lean: async () => result,
      }),
    }),
  };
}

const readySettings = {
  planningEnabled: true,
  remoteEnabled: true,
  dispatchEnabled: true,
  protocol: 'openai-chat' as const,
  endpoint: 'https://llm.rogly.net/v1/chat/completions',
  model: 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ',
  noProviderFee: false,
  dailyRequestLimit: 48,
  minimumIntervalSeconds: 300,
  maxOutputTokens: 2048,
  reservationMicros: 1000,
  organizationLimitMicros: 100000,
  projectLimitMicros: 50000,
  freePoolLimitMicros: 0,
  freePoolRemainingMicros: 0,
};

describe('attemptTeamChatReply full orchestra', () => {
  const plannerId = 'a'.repeat(24);
  const workerId = 'b'.repeat(24);
  const reviewerId = 'c'.repeat(24);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repoDig.mockResolvedValue({
      ok: true,
      okReads: 2,
      note: 'Read 2 file(s).',
      toolsUsed: ['repo_tree', 'repo_read'],
      contextBlock: 'File loadTaskRules.ts:\nexport async function loadIdeTaskRuleTexts',
      evidenceBlock: 'File loadTaskRules.ts:\nexport async function loadIdeTaskRuleTexts',
    });
    mocks.readSettings.mockResolvedValue({ value: readySettings });
    mocks.findObjectives.mockReturnValue(leanChain([]));
    mocks.findRuns.mockReturnValue(leanChain([]));
    mocks.findPipeline.mockReturnValue(
      leanChain({
        planner: { modelProfileId: plannerId, model: 'sol' },
        worker: { modelProfileId: workerId, model: 'qwen' },
        reviewer: { modelProfileId: reviewerId, model: 'sol-review' },
      })
    );
  });

  it('runs planner → worker → reviewer on chat and returns the reviewer reply', async () => {
    const stages: string[] = [];
    mocks.companyChat
      .mockImplementationOnce(async () => {
        stages.push('planner');
        return {
          requestId: '1',
          role: 'assistant',
          text: 'Dig into rules system paths.',
          toolsUsed: ['repo_tree'],
          costMicros: 100,
          reservedMicros: 0,
          noProviderFee: false,
        };
      })
      .mockImplementationOnce(async () => {
        stages.push('worker');
        return {
          requestId: '2',
          role: 'assistant',
          text: 'Found IdeTaskRulesPanel and loadIdeTaskRuleTexts.',
          toolsUsed: ['repo_read'],
          costMicros: 0,
          reservedMicros: 0,
          noProviderFee: true,
        };
      })
      .mockImplementationOnce(async () => {
        stages.push('reviewer');
        return {
          requestId: '3',
          role: 'assistant',
          text: 'Here is how the rules system works…',
          toolsUsed: [],
          costMicros: 80,
          reservedMicros: 0,
          noProviderFee: false,
        };
      });

    const onStage = vi.fn();
    const turn = await attemptTeamChatReply({
      employee: 'product',
      projectName: 'Nucleas',
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userId: 'u'.repeat(24),
      userText: 'how does our rules system work?',
      priorTurns: [],
      interactionMode: 'chat',
      onStage,
    });

    expect(stages).toEqual(['planner', 'worker', 'reviewer']);
    expect(mocks.companyChat).toHaveBeenCalledTimes(3);
    expect(turn.role).toBe('assistant');
    expect(turn.text).toBe('Here is how the rules system works…');
    expect(turn.toolsUsed).toEqual(['repo_tree', 'repo_read']);
    expect(turn.costMicros).toBe(180);
    expect(onStage.mock.calls.map((c) => c.slice(0, 2))).toEqual([
      ['planner', 'start'],
      ['planner', 'end'],
      ['worker', 'start'],
      ['worker', 'end'],
      ['reviewer', 'start'],
      ['reviewer', 'end'],
    ]);
    expect(mocks.repoDig).toHaveBeenCalledTimes(1);
    for (const call of mocks.companyChat.mock.calls) {
      expect(call[0]).toMatchObject({
        repoContextBlock: expect.stringContaining('loadTaskRules'),
      });
    }
  });

  it('on needs_more runs another Worker pass then accepts', async () => {
    const stages: string[] = [];
    mocks.companyChat.mockImplementation(async (args: { systemPrompt: string; userText: string }) => {
      if (args.systemPrompt.includes('Pipeline stage: planner')) {
        stages.push('planner');
        return {
          requestId: 'p',
          role: 'assistant',
          text: 'Dig history and rules.',
          toolsUsed: [],
          costMicros: 10,
          reservedMicros: 0,
          noProviderFee: false,
        };
      }
      if (args.systemPrompt.includes('Pipeline stage: worker')) {
        stages.push('worker');
        const continuePass = /needs_more/i.test(args.userText);
        return {
          requestId: continuePass ? 'w2' : 'w1',
          role: 'assistant',
          text: continuePass
            ? 'Quoted chatHistory appendIdeChatTurns persists user+assistant turns.'
            : 'Only saw rules panel.',
          toolsUsed: ['repo_read'],
          costMicros: 5,
          reservedMicros: 0,
          noProviderFee: true,
        };
      }
      stages.push('reviewer');
      const pass = stages.filter((s) => s === 'reviewer').length;
      if (pass === 1) {
        return {
          requestId: 'r1',
          role: 'assistant',
          text: [
            'Need history persistence evidence.',
            '```nucleas-gate',
            '{"status":"needs_more","jobs":["read src/lib/ide/chatHistory.ts and quote appendIdeChatTurns"],"reason":"no history"}',
            '```',
          ].join('\n'),
          toolsUsed: [],
          costMicros: 8,
          reservedMicros: 0,
          noProviderFee: false,
        };
      }
      return {
        requestId: 'r2',
        role: 'assistant',
        text: [
          'Chat history is stored via appendIdeChatTurns in chatHistory.ts.',
          '```nucleas-gate',
          '{"status":"accept"}',
          '```',
        ].join('\n'),
        toolsUsed: [],
        costMicros: 8,
        reservedMicros: 0,
        noProviderFee: false,
      };
    });

    const turn = await attemptTeamChatReply({
      employee: 'product',
      projectName: 'Nucleas',
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userId: 'u'.repeat(24),
      userText: 'how do we store context in our IDE?',
      priorTurns: [],
      interactionMode: 'chat',
    });

    expect(stages).toEqual(['planner', 'worker', 'reviewer', 'worker', 'reviewer']);
    expect(turn.role).toBe('assistant');
    expect(turn.text).toBe('Chat history is stored via appendIdeChatTurns in chatHistory.ts.');
    expect(turn.text).not.toMatch(/nucleas-gate/);
    expect(turn.toolsUsed).toEqual(['repo_read']);
    expect(turn.costMicros).toBe(10 + 5 + 8 + 5 + 8);
  });
});
