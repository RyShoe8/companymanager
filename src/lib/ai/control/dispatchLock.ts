import 'server-only';
import type { ClientSession, Types } from 'mongoose';
import { GatewayError } from '@nucleas/ai-core/gateway';
import { DISPATCH_USAGE_ID } from '@/lib/ai/control/dispatchLimits';
import { AiDispatchLock, AiRun } from '@/lib/models/AiControl';

const LIVE_RUN_STATUSES = new Set(['queued', 'running']);

/**
 * If another holder has an unexpired lock tied to a live run, throw unavailable.
 * Missing runId or a finished/cancelled/blocked run is treated as stealable.
 */
export async function assertDispatchLockClaimable(
  now: Date,
  session?: ClientSession
): Promise<void> {
  const lock = await AiDispatchLock.findById(DISPATCH_USAGE_ID).session(session ?? null);
  if (!lock || lock.expiresAt <= now) return;

  const holderRunId = lock.runId;
  if (!holderRunId) return;

  const run = await AiRun.findById(holderRunId).select('status').session(session ?? null).lean();
  if (!run || !LIVE_RUN_STATUSES.has(String(run.status))) return;

  throw new GatewayError('unavailable', { kind: 'dispatch_lock_held' });
}

export async function claimDispatchLock(input: {
  token: string;
  expiresAt: Date;
  runId: Types.ObjectId;
  session?: ClientSession;
}): Promise<void> {
  await AiDispatchLock.updateOne(
    { _id: DISPATCH_USAGE_ID },
    {
      $set: {
        token: input.token,
        expiresAt: input.expiresAt,
        runId: input.runId,
      },
    },
    { upsert: true, session: input.session }
  );
}

export async function releaseDispatchLock(token: string): Promise<void> {
  await AiDispatchLock.deleteOne({ _id: DISPATCH_USAGE_ID, token }).catch(() => undefined);
}

/**
 * Delete the lock as soon as Stop/disconnect aborts — do not wait for budget settle.
 * Returns an unsubscribe that removes the listener (e.g. after normal finish).
 */
export function watchAbortReleaseDispatchLock(
  signal: AbortSignal | undefined,
  token: string
): () => void {
  if (!signal) return () => undefined;

  const onAbort = () => {
    void releaseDispatchLock(token);
  };

  if (signal.aborted) {
    onAbort();
    return () => undefined;
  }

  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}
