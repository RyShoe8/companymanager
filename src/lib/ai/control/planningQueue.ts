import 'server-only';
import { Types, type ClientSession } from 'mongoose';
import { AiBudget, AiObjective, AiPlanningJob, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import { buildPlanningInput, digestValue } from '@nucleas/ai-core/planning';
import { AiHttpError, type requireAiProject } from './access';
import { getPlanningPolicy } from './config';
import { reserveRunBudget, settleRunBudget } from './budgets';
import { aiTransaction } from './transaction';

export type AiAccess = Awaited<ReturnType<typeof requireAiProject>>;
export async function queuePlanning(access: AiAccess, objectiveId: string, requestId: string) {
  if (!access.canManage) throw new AiHttpError(403, 'A manager or administrator must authorize remote planning.');
  const scope = { organizationId: access.organizationId, projectId: access.project._id };
  return aiTransaction(async session => {
    const existing = await AiPlanningJob.findOne({ ...scope, requestId }).session(session);
    if (existing) {
      if (String(existing.createdByUserId) !== access.userId || String(existing.objectiveId) !== objectiveId) throw new AiHttpError(409, 'Request key is already in use.');
      return { runId: String(existing.runId), alreadyQueued: true };
    }
    const policy = await getPlanningPolicy(access.organizationId, String(access.project._id), session);
    const objective = await AiObjective.findOne({ ...scope, _id: objectiveId }).session(session);
    if (!objective) throw new AiHttpError(404, 'Objective not found.');
    let input: string;
    try { input = buildPlanningInput({ title: objective.title, outcome: objective.outcome, constraints: objective.constraints, acceptanceCriteria: objective.acceptanceCriteria }); }
    catch { throw new AiHttpError(400, 'Objective is too large for remote planning. Shorten its outcome, constraints, or criteria.'); }
    if (await AiPlanningJob.exists({ ...scope, active: true }).session(session)) throw new AiHttpError(409, 'This project already has an active planning request.');
    const [run] = await AiRun.create([{ ...scope, objectiveId: objective._id,
      role: 'architect', status: 'queued', createdByUserId: access.userId,
      inputDigest: digestValue(input), policyDigest: policy.digest, model: policy.model,
    }], { session });
    const period = new Date().toISOString().slice(0, 7);
    const budgetIds: Types.ObjectId[] = [];
    for (const [scopeKey, limitMicros] of [
      ['organization', policy.organizationLimitMicros], [`project:${String(scope.projectId)}`, policy.projectLimitMicros],
    ] as const) {
      const budget = await AiBudget.findOneAndUpdate({ organizationId: access.organizationId, scopeKey, period },
        { $set: { limitMicros }, $setOnInsert: { spentMicros: 0, reservedMicros: 0 } },
        { session, upsert: true, new: true, runValidators: true });
      budgetIds.push(budget._id);
    }
    await reserveRunBudget(access.organizationId, run._id, budgetIds, policy.reservationMicros, session);
    await AiPlanningJob.create([{ ...scope, runId: run._id, objectiveId: objective._id,
      createdByUserId: access.userId, requestId, input, inputDigest: run.inputDigest, policyDigest: policy.digest,
      projectUpdatedAt: access.project.updatedAt, reservationMicros: policy.reservationMicros,
    }], { session });
    await AiRunEvent.create([{ ...scope, runId: run._id, sequence: 0, type: 'run.queued',
      summary: 'Remote planning authorized by a human; budget reserved. No tasks have been created.',
    }], { session });
    return { runId: String(run._id), alreadyQueued: false };
  });
}

export async function cancelPlanning(access: AiAccess, runId: string) {
  if (!access.canManage) throw new AiHttpError(403, 'A manager or administrator must cancel planning.');
  return aiTransaction(async session => {
    const scope = { organizationId: access.organizationId, projectId: access.project._id };
    const job = await AiPlanningJob.findOne({ ...scope, runId }).session(session);
    if (!job) throw new AiHttpError(404, 'Planning request not found.');
    if (!job.active || job.cancelRequested) return { status: job.status };
    job.cancelRequested = true;
    if (job.status === 'queued') {
      job.status = 'cancelled'; job.active = false;
      await settleRunBudget(job.organizationId, job.runId, 0, session);
    }
    await job.save({ session });
    const run = await AiRun.findOneAndUpdate({ ...scope, _id: job.runId }, {
      $set: { status: job.status === 'cancelled' ? 'cancelled' : 'cancellation_requested',
        ...(job.status === 'cancelled' ? { completedAt: new Date(), costMicros: 0 } : {}) }, $inc: { revision: 1 },
    }, { session, new: true });
    if (!run) throw new Error('Missing run.');
    await AiRunEvent.create([{ ...scope, runId: run._id, sequence: run.revision,
      type: job.status === 'cancelled' ? 'run.cancelled' : 'run.cancellation_requested',
      summary: job.status === 'cancelled' ? 'Cancelled before inference; reservation released.' : 'Cancellation requested. Any returned draft will be discarded; remote inference may still finish.',
    }], { session });
    return { status: run.status };
  });
}

export async function updatePlanningRun(job: InstanceType<typeof AiPlanningJob>, status: 'queued' | 'running' | 'blocked' | 'awaiting_acceptance' | 'cancelled',
  summary: string, session: ClientSession, details: { failureCode?: string; planId?: Types.ObjectId;
    inputTokens?: number; outputTokens?: number; latencyMs?: number; costMicros?: number } = {}) {
  const run = await AiRun.findOneAndUpdate({ _id: job.runId, organizationId: job.organizationId, projectId: job.projectId }, {
    $set: { status, ...details, ...(status === 'queued' ? {} : status === 'running' ? { startedAt: new Date() } : { completedAt: new Date() }) },
    $inc: { revision: 1 },
  }, { session, new: true });
  if (!run) throw new Error('Missing run.');
  await AiRunEvent.create([{ organizationId: job.organizationId, projectId: job.projectId,
    runId: run._id, sequence: run.revision, type: `run.${status}`, summary,
  }], { session });
}
