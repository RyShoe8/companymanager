import 'server-only';
import type { ClientSession } from 'mongoose';
import { AiDispatchUsage } from '@/lib/models/AiControl';

export const DISPATCH_USAGE_ID = 'remote-planning-v1';
type Limits = { dailyRequestLimit: number; minimumIntervalSeconds: number };
type Usage = { day: string; attempts: number; lastStartedAt: Date };

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
