import 'server-only';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { invokeModel, GatewayError } from '@nucleas/ai-core/gateway';
import { buildPlanningInput, digestValue, parseGeneratedPlan, planningRequest } from '@nucleas/ai-core/planning';
import type { ModelResult, PlanDraft } from '@nucleas/ai-contracts';
import { AiDispatchLock, AiDispatchUsage, AiObjective, AiPlan, AiPlanningJob } from '@/lib/models/AiControl';
import { dispatchAllowed, reserveDispatch, DISPATCH_USAGE_ID } from '@/lib/ai/control/dispatchLimits';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import connectDB from '@/lib/db/mongodb';
import { readPlatformSettings } from '@/lib/ai/control/settings';
import { getPlanningPolicy, isAiPlanningEnabled } from '@/lib/ai/control/config';
import { updatePlanningRun } from '@/lib/ai/control/planningQueue';
import { settleRunBudget } from '@/lib/ai/control/budgets';
import { planDigest } from '@/lib/ai/control/plans';
import { aiTransaction } from '@/lib/ai/control/transaction';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';
import { clearTerminalPlanningContexts, CLEARED_PLANNING_CONTEXT } from '@/lib/ai/control/contextRetention';

const LOCK_ID = 'remote-planning-v1';
// Exceeds the function's 300s ceiling, so a replacement cannot overlap a live invocation.
const LEASE_MS = 360000;
type Job = InstanceType<typeof AiPlanningJob>;
type Policy = Awaited<ReturnType<typeof getPlanningPolicy>>;

async function currentInputIsAuthorized(job: Job): Promise<boolean> {
  if (!await isAiPlanningEnabled()) return false;
  const member = await User.exists({ _id: job.createdByUserId, organizationId: job.organizationId });
  const approver = await Employee.exists({ userId: job.createdByUserId, organizationId: job.organizationId,
    role: { $in: ['Manager', 'Administrator'] } });
  if (!member || !approver) return false;
  const ownerIds = await User.find({ organizationId: job.organizationId }).select('_id').lean();
  const project = await Project.exists({ _id: job.projectId, userId: { $in: ownerIds.map(user => user._id) }, updatedAt: job.projectUpdatedAt });
  const objective = await AiObjective.findOne({ _id: job.objectiveId, organizationId: job.organizationId, projectId: job.projectId });
  if (!project || !objective) return false;
  const input = buildPlanningInput({ title: objective.title, outcome: objective.outcome,
    constraints: objective.constraints, acceptanceCriteria: objective.acceptanceCriteria });
  return digestValue(input) === job.inputDigest && digestValue(job.input) === job.inputDigest;
}

/** A terminal write must match the exact lease. A stale process can never publish a draft. */
async function finish(job: Job, options: { draft?: PlanDraft; result?: ModelResult; failureCode?: string;
  actualMicros: number | null; expired?: boolean }) {
  return aiTransaction(async session => {
    const now = new Date();
    const current = await AiPlanningJob.findOne({ _id: job._id, status: 'running', leaseToken: job.leaseToken,
      leaseExpiresAt: options.expired ? { $lte: now } : { $gt: now },
    }).session(session);
    if (!current) return false;
    let planId: Types.ObjectId | undefined;
    if (options.draft && !current.cancelRequested) {
      const [plan] = await AiPlan.create([{ organizationId: current.organizationId, projectId: current.projectId,
        objectiveId: current.objectiveId, createdByUserId: current.createdByUserId,
        requestId: `run:${String(current.runId)}`, runId: current.runId, source: 'remote-model',
        ...options.draft, digest: planDigest(options.draft), projectUpdatedAt: current.projectUpdatedAt,
        expiresAt: new Date(Date.now() + 86400000),
      }], { session });
      planId = plan._id;
    }
    const status = current.cancelRequested ? 'cancelled' : planId ? 'awaiting_acceptance' : 'blocked';
    current.status = status === 'awaiting_acceptance' ? 'done' : status;
    current.active = false;
    // Clear persisted prompt data after the attempt; inputDigest remains as provenance.
    current.input = CLEARED_PLANNING_CONTEXT;
    current.inputClearedAt = new Date();
    await current.save({ session });
    await settleRunBudget(current.organizationId, current.runId, options.actualMicros, session);
    await updatePlanningRun(current, status,
      status === 'cancelled' ? 'Result acceptance fenced by cancellation. Remote inference may still have run.' :
        planId ? 'AI draft ready for human review. No project tasks have been created.' :
          `Planning blocked (${options.failureCode ?? 'unknown'}). No automatic retry; review before submitting again.`,
      session, { planId, failureCode: options.failureCode,
        inputTokens: options.result?.inputTokens ?? undefined, outputTokens: options.result?.outputTokens ?? undefined,
        latencyMs: options.result?.latencyMs, costMicros: options.actualMicros ?? undefined });
    return true;
  });
}

/** One bounded serverless invocation, never a background promise attached to a user request. */
export async function processPlanningQueue(): Promise<{ status: string; runId?: string }> {
  await connectDB();
  await ensureAiIndexes();
  // Privacy maintenance is independent of permission to send new model requests.
  await clearTerminalPlanningContexts();
  if (!(await readPlatformSettings()).value.dispatchEnabled) return { status: 'disabled' };
  const token = randomUUID();
  const now = new Date();
  try {
    await AiDispatchLock.findOneAndUpdate({ _id: LOCK_ID, expiresAt: { $lte: now } },
      { $set: { token, expiresAt: new Date(now.getTime() + LEASE_MS) } }, { upsert: true, new: true });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 11000) return { status: 'busy' };
    throw error;
  }
  let releaseLock = true;
  try {
    // Crashed/expired attempts are not replayed: provider completion and charges may be unknown.
    const expired = await AiPlanningJob.find({ status: 'running', leaseExpiresAt: { $lte: now } }).limit(10);
    for (const job of expired) await finish(job, { failureCode: 'lease_expired', actualMicros: job.dispatchedAt ? null : 0, expired: true });
    if (!dispatchAllowed(await AiDispatchUsage.findById(DISPATCH_USAGE_ID),
      (await readPlatformSettings()).value, new Date())) return { status: 'throttled' };
    const job = await aiTransaction(async session => {
      const claimed = await AiPlanningJob.findOneAndUpdate({ status: 'queued', cancelRequested: false }, {
        $set: { status: 'running', leaseToken: token, leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
      }, { session, sort: { createdAt: 1 }, new: true });
      if (claimed) await updatePlanningRun(claimed, 'running', 'Planning worker claimed the request; validating current permissions.', session);
      return claimed;
    });
    if (!job) return { status: 'idle' };
    let policy: Policy;
    try { policy = await getPlanningPolicy(job.organizationId, String(job.projectId)); }
    catch { await finish(job, { failureCode: 'configuration', actualMicros: 0 }); return { status: 'blocked', runId: String(job.runId) }; }
    if (job.policyDigest !== policy.digest || !await currentInputIsAuthorized(job)) {
      await finish(job, { failureCode: 'stale_input_or_policy', actualMicros: 0 });
      return { status: 'blocked', runId: String(job.runId) };
    }
    // Mark an attempt BEFORE network I/O. Recovery conservatively retains its reservation.
    const dispatched = await aiTransaction(async session => {
      const current = await AiPlanningJob.findOne({ _id: job._id, leaseToken: token, status: 'running',
        cancelRequested: false, leaseExpiresAt: { $gt: new Date() },
      }).session(session);
      if (!current) return 'cancelled';
      const latest = await getPlanningPolicy(job.organizationId, String(job.projectId), session);
      if (latest.digest !== policy.digest) return 'stale';
      if (!await reserveDispatch(latest, new Date(), session)) {
        current.status = 'queued'; current.leaseToken = undefined; current.leaseExpiresAt = undefined;
        await current.save({ session });
        await updatePlanningRun(current, 'queued', 'Waiting for the shared inference request limit; no remote call was sent.', session);
        return 'throttled';
      }
      current.dispatchedAt = new Date();
      await current.save({ session });
      return 'dispatched';
    });
    if (dispatched === 'throttled') return { status: 'throttled', runId: String(job.runId) };
    if (dispatched === 'stale') {
      await finish(job, { failureCode: 'stale_input_or_policy', actualMicros: 0 });
      return { status: 'blocked', runId: String(job.runId) };
    }
    if (dispatched !== 'dispatched') {
      await finish(job, { failureCode: 'cancelled_before_dispatch', actualMicros: 0 });
      return { status: 'cancelled', runId: String(job.runId) };
    }
    let result: ModelResult | undefined;
    try {
      result = await invokeModel(policy.gateway, planningRequest(job.input, policy.maxOutputTokens));
      const draft = parseGeneratedPlan(result.content);
      // Config/membership/project changes during inference invalidate publication too.
      if ((await getPlanningPolicy(job.organizationId, String(job.projectId))).digest !== policy.digest || !await currentInputIsAuthorized(job)) {
        await finish(job, { result, failureCode: 'stale_input_or_policy', actualMicros: policy.noProviderFee ? 0 : null });
        return { status: 'blocked', runId: String(job.runId) };
      }
      const saved = await finish(job, { draft, result, actualMicros: policy.noProviderFee ? 0 : null });
      return { status: saved ? 'processed' : 'lease_lost', runId: String(job.runId) };
    } catch (error) {
      const code = error instanceof GatewayError ? error.code : result ? 'invalid_plan' : 'internal_error';
      // An ambiguous failure may leave inference running remotely. Do not immediately reuse the lease.
      releaseLock = result !== undefined || code === 'credentials' || code === 'rate_limit';
      await finish(job, { result, failureCode: code, actualMicros: policy.noProviderFee ? 0 : null });
      return { status: 'blocked', runId: String(job.runId) };
    }
  } finally {
    if (releaseLock) await AiDispatchLock.deleteOne({ _id: LOCK_ID, token });
  }
}
