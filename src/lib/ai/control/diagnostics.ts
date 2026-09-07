import 'server-only';
import connectDB from '@/lib/db/mongodb';
import { AiDispatchLock, AiPlanningJob } from '@/lib/models/AiControl';

/** Bounded, read-only operational evidence. Never returns job context or lease credentials. */
export async function planningDiagnostics(now = new Date()) {
  await connectDB();
  const [queued, running, expired, lock] = await Promise.all([
    AiPlanningJob.find({ status: 'queued' }).select('createdAt -_id').sort({ createdAt: 1 }).limit(101).maxTimeMS(3000).lean(),
    AiPlanningJob.find({ status: 'running' }).select('_id').limit(101).maxTimeMS(3000).lean(),
    AiPlanningJob.find({ status: 'running', leaseExpiresAt: { $lte: now } }).select('_id').limit(101).maxTimeMS(3000).lean(),
    AiDispatchLock.findById('remote-planning-v1').select('expiresAt -_id').maxTimeMS(3000).lean(),
  ]);
  const count = (rows: unknown[]) => ({ count: Math.min(rows.length, 100), capped: rows.length > 100 });
  return { asOf: now.toISOString(), queued: count(queued), running: count(running), expired: count(expired),
    oldestQueuedAt: queued[0]?.createdAt?.toISOString() ?? null,
    dispatchLeaseExpiresAt: lock?.expiresAt && lock.expiresAt > now ? lock.expiresAt.toISOString() : null };
}
