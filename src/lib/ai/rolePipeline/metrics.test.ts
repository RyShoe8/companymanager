import { describe, expect, it } from 'vitest';
import { pipelineRunMetrics } from '@/lib/ai/rolePipeline/metrics';

describe('pipelineRunMetrics', () => {
  it('reports stage calls, correction passes and commercial cost share', () => {
    const result = pipelineRunMetrics([
      { stage: 'planner', status: 'running' },
      { stage: 'planner', status: 'completed', modelTier: 'commercial', costMicros: 100 },
      { stage: 'worker', status: 'running' },
      { stage: 'worker', status: 'completed', modelTier: 'local_remote', costMicros: 0, noProviderFee: true },
      { stage: 'reviewer', status: 'running' },
      { stage: 'reviewer', status: 'completed', modelTier: 'commercial', costMicros: 50 },
      { stage: 'worker', status: 'running' },
      { stage: 'worker', status: 'completed', modelTier: 'local_remote', costMicros: 0, noProviderFee: true },
    ]);
    expect(result.stageInvocations).toEqual({ planner: 1, worker: 2, reviewer: 1 });
    expect(result.correctionPasses).toBe(1);
    expect(result.costByStageMicros).toEqual({ planner: 100, worker: 0, reviewer: 50 });
    expect(result.commercialCostSharePercent).toBe(100);
  });
});
