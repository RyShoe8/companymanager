import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/models/AiControl', () => ({
  AiRun: {
    aggregate: (...args: unknown[]) => {
      const chain = {
        option: () => mocks.aggregate(...args),
      };
      return chain;
    },
  },
  AiBudget: {
    findOne: (...args: unknown[]) => mocks.findOne(...args),
  },
}));

import { loadIdeProjectSpend } from '@/lib/ide/ideSpend';

describe('loadIdeProjectSpend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aggregate.mockResolvedValue([{ total: 1_500_000 }]);
    mocks.findOne.mockReturnValue({
      select: () => ({
        maxTimeMS: () => ({
          lean: () => Promise.resolve({ spentMicros: 4_000_000, reservedMicros: 500_000 }),
        }),
      }),
    });
  });

  it('sums daily run costs and monthly spent+reserved', async () => {
    const projectId = new Types.ObjectId().toString();
    const spend = await loadIdeProjectSpend('org', projectId);
    expect(spend.dailyEstimatedMicros).toBe(1_500_000);
    expect(spend.monthlyEstimatedMicros).toBe(4_500_000);
    expect(spend.periodMonth).toMatch(/^\d{4}-\d{2}$/);
  });
});
