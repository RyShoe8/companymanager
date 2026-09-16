import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { GatewayError } from '@nucleas/ai-core/gateway';

const mocks = vi.hoisted(() => ({
  findLock: vi.fn(),
  updateLock: vi.fn(),
  deleteLock: vi.fn(),
  findRun: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/models/AiControl', () => ({
  AiDispatchLock: {
    findById: (...args: unknown[]) => mocks.findLock(...args),
    updateOne: (...args: unknown[]) => mocks.updateLock(...args),
    deleteOne: (...args: unknown[]) => mocks.deleteLock(...args),
  },
  AiRun: {
    findById: (...args: unknown[]) => mocks.findRun(...args),
  },
}));

import {
  assertDispatchLockClaimable,
  claimDispatchLock,
  releaseDispatchLock,
  watchAbortReleaseDispatchLock,
} from '@/lib/ai/control/dispatchLock';

describe('dispatchLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findLock.mockReturnValue({ session: () => Promise.resolve(null) });
    mocks.findRun.mockReturnValue({
      select: () => ({
        session: () => ({
          lean: async () => null,
        }),
      }),
    });
    mocks.updateLock.mockResolvedValue({});
    mocks.deleteLock.mockResolvedValue({});
  });

  it('allows claim when no lock exists', async () => {
    mocks.findLock.mockReturnValue({ session: () => Promise.resolve(null) });
    await expect(assertDispatchLockClaimable(new Date())).resolves.toBeUndefined();
  });

  it('allows claim when lock is expired', async () => {
    mocks.findLock.mockReturnValue({
      session: () =>
        Promise.resolve({
          expiresAt: new Date('2020-01-01'),
          runId: new Types.ObjectId(),
        }),
    });
    await expect(assertDispatchLockClaimable(new Date())).resolves.toBeUndefined();
  });

  it('steals when holder run is blocked', async () => {
    const runId = new Types.ObjectId();
    mocks.findLock.mockReturnValue({
      session: () =>
        Promise.resolve({
          expiresAt: new Date(Date.now() + 60_000),
          runId,
        }),
    });
    mocks.findRun.mockReturnValue({
      select: () => ({
        session: () => ({
          lean: async () => ({ status: 'blocked' }),
        }),
      }),
    });
    await expect(assertDispatchLockClaimable(new Date())).resolves.toBeUndefined();
  });

  it('protects unexpired lock when holder runId is missing', async () => {
    mocks.findLock.mockReturnValue({
      session: () =>
        Promise.resolve({
          expiresAt: new Date(Date.now() + 60_000),
        }),
    });
    await expect(assertDispatchLockClaimable(new Date())).rejects.toBeInstanceOf(GatewayError);
  });

  it('rejects when holder run is still running', async () => {
    const runId = new Types.ObjectId();
    mocks.findLock.mockReturnValue({
      session: () =>
        Promise.resolve({
          expiresAt: new Date(Date.now() + 60_000),
          runId,
        }),
    });
    mocks.findRun.mockReturnValue({
      select: () => ({
        session: () => ({
          lean: async () => ({ status: 'running' }),
        }),
      }),
    });
    await expect(assertDispatchLockClaimable(new Date())).rejects.toBeInstanceOf(GatewayError);
  });

  it('claims with runId and releases by token', async () => {
    const runId = new Types.ObjectId();
    await claimDispatchLock({
      token: 'tok',
      expiresAt: new Date(Date.now() + 1000),
      runId,
    });
    expect(mocks.updateLock).toHaveBeenCalledWith(
      { _id: 'remote-planning-v1' },
      { $set: { token: 'tok', expiresAt: expect.any(Date), runId } },
      { upsert: true, session: undefined }
    );
    await releaseDispatchLock('tok');
    expect(mocks.deleteLock).toHaveBeenCalledWith({ _id: 'remote-planning-v1', token: 'tok' });
  });

  it('shortens the lock to a grace period on abort', async () => {
    const controller = new AbortController();
    const stop = watchAbortReleaseDispatchLock(controller.signal, 'abort-tok');
    controller.abort();
    await vi.waitFor(() => {
      expect(mocks.updateLock).toHaveBeenCalledWith(
        { _id: 'remote-planning-v1', token: 'abort-tok' },
        { $set: { expiresAt: expect.any(Date) } }
      );
    });
    stop();
  });
});
