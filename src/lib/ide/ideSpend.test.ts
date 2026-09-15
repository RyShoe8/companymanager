import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  findOne: vi.fn(),
  searchFindOne: vi.fn(),
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
  AiSearchApiUsage: {
    findOne: (...args: unknown[]) => mocks.searchFindOne(...args),
  },
}));

import { loadIdeOrgSpend, loadIdeProjectSpend, loadIdeSpendBundle } from '@/lib/ide/ideSpend';

describe('ideSpend', () => {
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
    mocks.searchFindOne.mockReturnValue({
      select: () => ({
        maxTimeMS: () => ({
          lean: () =>
            Promise.resolve({
              braveQueries: 0,
              googleCseWebQueries: 0,
              googleCseImageQueries: 0,
            }),
        }),
      }),
    });
  });

  it('sums daily run costs and monthly spent+reserved for a project', async () => {
    const projectId = new Types.ObjectId().toString();
    const spend = await loadIdeProjectSpend('org', projectId);
    expect(spend.dailyEstimatedMicros).toBe(1_500_000);
    expect(spend.monthlyEstimatedMicros).toBe(4_500_000);
    expect(spend.periodMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('loads organization ledger separately', async () => {
    const spend = await loadIdeOrgSpend('org');
    expect(spend.monthlyEstimatedMicros).toBe(4_500_000);
    expect(mocks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ scopeKey: 'organization' })
    );
  });

  it('bundles project, org, and search API spend', async () => {
    const projectId = new Types.ObjectId().toString();
    const bundle = await loadIdeSpendBundle({ organizationId: 'org', projectId });
    expect(bundle.project?.monthlyEstimatedMicros).toBe(4_500_000);
    expect(bundle.organization.monthlyEstimatedMicros).toBe(4_500_000);
    expect(bundle.searchApi.estimatedMicros).toBe(0);
  });
});
