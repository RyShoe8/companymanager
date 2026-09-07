import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connect: vi.fn(), find: vi.fn(), lock: vi.fn() }));
vi.mock('@/lib/db/mongodb', () => ({ default: mocks.connect }));
vi.mock('@/lib/models/AiControl', () => ({ AiPlanningJob: { find: mocks.find }, AiDispatchLock: { findById: mocks.lock } }));
import { planningDiagnostics } from './diagnostics';
function query(rows: unknown) {
  const result = { select: vi.fn(), sort: vi.fn(), limit: vi.fn(), maxTimeMS: vi.fn(), lean: vi.fn().mockResolvedValue(rows) };
  for (const method of [result.select, result.sort, result.limit, result.maxTimeMS]) method.mockReturnValue(result);
  return result;
}
beforeEach(() => vi.resetAllMocks());
describe('bounded planning diagnostics', () => {
  it('caps counts and only returns safe operational evidence', async () => {
    const now = new Date('2026-09-06T12:00:00Z');
    const queued = query(Array.from({ length: 101 }, () => ({ createdAt: now, input: 'private prompt' })));
    const running = query([{ leaseToken: 'private token' }]);
    const expired = query([]);
    mocks.find.mockReturnValueOnce(queued).mockReturnValueOnce(running).mockReturnValueOnce(expired);
    mocks.lock.mockReturnValue(query({ expiresAt: new Date('2026-09-06T12:06:00Z'), token: 'private token' }));
    const result = await planningDiagnostics(now);
    expect(result).toEqual({ asOf: now.toISOString(), queued: { count: 100, capped: true },
      running: { count: 1, capped: false }, expired: { count: 0, capped: false },
      oldestQueuedAt: now.toISOString(), dispatchLeaseExpiresAt: '2026-09-06T12:06:00.000Z' });
    for (const item of [queued, running, expired]) {
      expect(item.limit).toHaveBeenCalledWith(101); expect(item.maxTimeMS).toHaveBeenCalledWith(3000);
    }
    expect(mocks.find).toHaveBeenCalledWith({ status: 'running', leaseExpiresAt: { $lte: now } });
  });
  it('does not report an expired dispatch lease as held', async () => {
    mocks.find.mockImplementation(() => query([])); mocks.lock.mockReturnValue(query({ expiresAt: new Date(0) }));
    expect(await planningDiagnostics()).toMatchObject({ oldestQueuedAt: null, dispatchLeaseExpiresAt: null });
  });
});
