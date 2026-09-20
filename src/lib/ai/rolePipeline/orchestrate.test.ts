import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  findPipeline: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/rolePipeline/stageInvoke', () => ({
  invokeProfileStage: (...args: unknown[]) => mocks.invoke(...args),
}));
vi.mock('@/lib/models/AiRolePipeline', () => ({
  AiRolePipeline: { findOne: (...args: unknown[]) => mocks.findPipeline(...args) },
  AiPipelineRun: {
    create: (...args: unknown[]) => mocks.createRun(...args),
    updateOne: (...args: unknown[]) => mocks.updateRun(...args),
  },
  AiPipelineStageEvent: { create: (...args: unknown[]) => mocks.createEvent(...args) },
}));

import { runRolePipeline } from '@/lib/ai/rolePipeline/orchestrate';

const profile = (id: string, label: string, content: string) => ({
  content,
  costMicros: 1,
  reservedMicros: 1,
  noProviderFee: false,
  aiRunId: new Types.ObjectId().toString(),
  profile: { id, label, tier: 'commercial', model: label.toLowerCase() },
});

function pipelineChain(value: unknown) {
  return { maxTimeMS: () => ({ lean: async () => value }) };
}

describe('runRolePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPipeline.mockReturnValue(
      pipelineChain({
        enabled: true,
        planner: { modelProfileId: new Types.ObjectId(), model: 'planner' },
        worker: { modelProfileId: new Types.ObjectId(), model: 'worker' },
        reviewer: { modelProfileId: new Types.ObjectId(), model: 'reviewer' },
        maxSubtasks: 5,
        maxWorkerRetries: 1,
      })
    );
    mocks.createRun.mockResolvedValue([{ _id: new Types.ObjectId() }]);
    mocks.updateRun.mockResolvedValue({ acknowledged: true });
    mocks.createEvent.mockResolvedValue({});
  });

  it('executes multiple planned jobs as one worker bundle and one batched review', async () => {
    mocks.invoke
      .mockResolvedValueOnce(
        profile('planner', 'Planner', JSON.stringify({
          summary: 'Ship the feature',
          subtasks: [
            { id: 'one', title: 'Foundation', instructions: 'Add contract.', acceptanceChecks: ['Contract passes'] },
            { id: 'two', title: 'UI', instructions: 'Add UI.', acceptanceChecks: ['UI passes'] },
          ],
        }))
      )
      .mockResolvedValueOnce(
        profile('worker', 'Worker', JSON.stringify({
          summary: 'Completed the complete feature slice.',
          completedSubtaskIds: ['one', 'two'],
          changedFiles: ['src/contract.ts', 'src/page.tsx'],
          checks: [{ command: 'npm test', status: 'passed', evidence: '12 tests passed' }],
          limitations: [],
        }))
      )
      .mockResolvedValueOnce(
        profile('reviewer', 'Reviewer', JSON.stringify({ decision: 'pass', notes: 'All criteria met.', corrections: [] }))
      );

    const result = await runRolePipeline({
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      projectName: 'Nucleas',
      userId: new Types.ObjectId().toString(),
      employee: 'engineering',
      brief: 'Build the feature.',
    });

    expect(result.status).toBe('completed');
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
    const workerMessage = mocks.invoke.mock.calls[1][0].messages[1].content;
    expect(workerMessage).toContain('Foundation');
    expect(workerMessage).toContain('UI');
    const reviewerMessage = mocks.invoke.mock.calls[2][0].messages[1].content;
    expect(reviewerMessage).toContain('src/contract.ts');
    expect(reviewerMessage).toContain('12 tests passed');
  });

  it('batches reviewer corrections into one bounded worker retry', async () => {
    const plan = profile('planner', 'Planner', JSON.stringify({
      summary: 'One slice',
      subtasks: [{ id: 'one', title: 'Feature', instructions: 'Implement it.', acceptanceChecks: ['Tests pass'] }],
    }));
    const evidence = (summary: string) => profile('worker', 'Worker', JSON.stringify({
      summary,
      completedSubtaskIds: ['one'],
      changedFiles: [],
      checks: [{ command: 'npm test', status: 'not_run', evidence: 'Not available' }],
      limitations: ['Tests not run'],
    }));
    mocks.invoke
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(evidence('Initial pass'))
      .mockResolvedValueOnce(profile('reviewer', 'Reviewer', JSON.stringify({
        decision: 'retry', notes: 'Verification missing.', corrections: ['Run the focused test', 'Report the result'],
      })))
      .mockResolvedValueOnce(evidence('Corrected pass'))
      .mockResolvedValueOnce(profile('reviewer', 'Reviewer', JSON.stringify({
        decision: 'pass', notes: 'Verified.', corrections: [],
      })));

    const result = await runRolePipeline({
      organizationId: 'org', projectId: new Types.ObjectId(), projectName: 'Nucleas',
      userId: new Types.ObjectId().toString(), employee: 'engineering', brief: 'Build it.',
    });

    expect(result.status).toBe('completed');
    expect(mocks.invoke).toHaveBeenCalledTimes(5);
    expect(mocks.invoke.mock.calls[3][0].messages[0].content).toContain('Run the focused test');
    expect(mocks.invoke.mock.calls[3][0].messages[0].content).toContain('Report the result');
  });
});
