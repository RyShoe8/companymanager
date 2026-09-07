import 'server-only';
import type { ClientSession } from 'mongoose';
import { AiDispatchUsage } from '@/lib/models/AiControl';
import type { DispatchUsageView } from '../dispatchUsageView';

export const DISPATCH_USAGE_ID = 'remote-planning-v1';
type Limits = { dailyRequestLimit: number; minimumIntervalSeconds: number };
type Usage = { day: string; attempts: number; lastStartedAt: Date };

export function dispatchUsageView(usage: Usage | null, limits: Limits,
  processingEnabled: boolean, now: Date): DispatchUsageView {
  const utcDay = now.toISOString().slice(0, 10);
  const attempts = usage?.day === utcDay ? usage.attempts : 0;
  const midnight = new Date(`${utcDay}T00:00:00.000Z`).getTime() + 86400000;
  const nextEligible = Math.max(now.getTime(),
    usage ? usage.lastStartedAt.getTime() + limits.minimumIntervalSeconds * 1000 : 0,
    attempts >= limits.dailyRequestLimit ? midnight : 0);
  return { asOf: now.toISOString(), utcDay, attempts, dailyLimit: limits.dailyRequestLimit,
    remaining: Math.max(0, limits.dailyRequestLimit - attempts),
    lastAttemptAt: usage?.lastStartedAt.toISOString() ?? null,
    nextEligibleAt: new Date(nextEligible).toISOString(), processingEnabled };
}

export function dispatchAllowed(usage: Usage | null, limits: Limits, now: Date): boolean {
  if (!usage) return true;
  return now.getTime() - usage.lastStartedAt.getTime() >= limits.minimumIntervalSeconds * 1000 &&
    (usage.day !== now.toISOString().slice(0, 10) || usage.attempts < limits.dailyRequestLimit);
}

/** Call within the dispatch-marker transaction. Attempts are never refunded, including crashes. */
export async function reserveDispatch(limits: Limits, now: Date, session: ClientSession): Promise<boolean> {
  const usage = await AiDispatchUsage.findById(DISPATCH_USAGE_ID).session(session);
  if (!dispatchAllowed(usage, limits, now)) return false;
  const day = now.toISOString().slice(0, 10);
  await AiDispatchUsage.updateOne({ _id: DISPATCH_USAGE_ID }, { $set: {
    day, attempts: usage?.day === day ? usage.attempts + 1 : 1, lastStartedAt: now,
  } }, { upsert: true, session });
  return true;
}
