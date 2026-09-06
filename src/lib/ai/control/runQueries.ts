import 'server-only';
import { Types } from 'mongoose';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { AiRun, AiRunEvent, AiPlanningJob, AiPlan, AiBudgetReservation, AiBudget } from '@/lib/models/AiControl';
import { AiHttpError } from './access';
import type { AiAccess } from './planningQueue';
import type { AiRunDetail, AiRunPage, AiRunSummary, AiEventPage } from '@/lib/ai/runView';

export const RUN_PAGE_SIZE = 25;
export const EVENT_PAGE_SIZE = 50;
const runFields = 'role status model createdAt startedAt completedAt failureCode inputTokens outputTokens latencyMs costMicros';
const cursorSchema = z.object({ v: z.literal(1), projectId: objectIdSchema, id: objectIdSchema, createdAt: z.string().datetime() }).strict();
type ScopeAccess = Pick<AiAccess, 'organizationId' | 'project'>;
const scopeFor = (access: ScopeAccess) => ({ organizationId: access.organizationId, projectId: access.project._id });
const iso = (value?: Date | null) => value ? value.toISOString() : null;
type RunRecord = {
  _id: Types.ObjectId; role: string; status: string; model?: string | null; createdAt: Date;
  startedAt?: Date | null; completedAt?: Date | null; failureCode?: string | null;
  inputTokens?: number | null; outputTokens?: number | null; latencyMs?: number | null; costMicros?: number | null;
};
function summary(run: RunRecord): AiRunSummary {
  return { id: String(run._id), role: run.role, status: run.status, model: run.model ?? null, createdAt: run.createdAt.toISOString(),
    startedAt: iso(run.startedAt), completedAt: iso(run.completedAt), failureCode: run.failureCode ?? null,
    inputTokens: run.inputTokens ?? null, outputTokens: run.outputTokens ?? null, latencyMs: run.latencyMs ?? null, costMicros: run.costMicros ?? null };
}
export function decodeRunCursor(raw: string | null, projectId: string) {
  if (raw === null) return null;
  try {
    if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid cursor.');
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    if (parsed.projectId !== projectId) throw new Error('Cursor project mismatch.');
    return parsed;
  } catch { throw new AiHttpError(400, 'Invalid history cursor. Return to the newest runs.'); }
}
export function parseEventAfter(raw: string | null): number {
  if (raw === null) return -1;
  if (!/^\d{1,15}$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new AiHttpError(400, 'Invalid event cursor.');
  return Number(raw);
}
export async function listProjectRuns(access: ScopeAccess, rawCursor: string | null): Promise<AiRunPage> {
  const projectId = String(access.project._id);
  const cursor = decodeRunCursor(rawCursor, projectId);
  const query = { ...scopeFor(access), ...(cursor ? { $or: [
    { createdAt: { $lt: new Date(cursor.createdAt) } },
    { createdAt: new Date(cursor.createdAt), _id: { $lt: new Types.ObjectId(cursor.id) } },
  ] } : {}) };
  const records = await AiRun.find(query).select(runFields).sort({ createdAt: -1, _id: -1 }).limit(RUN_PAGE_SIZE + 1).lean();
  const page = records.slice(0, RUN_PAGE_SIZE);
  const last = page.at(-1);
  return { runs: page.map(summary), nextCursor: records.length > RUN_PAGE_SIZE && last ? Buffer.from(JSON.stringify({
    v: 1, projectId, id: String(last._id), createdAt: last.createdAt.toISOString(),
  })).toString('base64url') : null };
}
async function scopedRun(access: ScopeAccess, runId: string) {
  if (!objectIdSchema.safeParse(runId).success) throw new AiHttpError(404, 'Run not found.');
  const run = await AiRun.findOne({ ...scopeFor(access), _id: runId })
    .select(`${runFields} revision objectiveId taskId inputDigest policyDigest planId`).lean();
  if (!run) throw new AiHttpError(404, 'Run not found.');
  return run;
}
export async function getRunDetail(access: ScopeAccess, runId: string): Promise<AiRunDetail> {
  const run = await scopedRun(access, runId);
  const scope = scopeFor(access);
  const [job, plan, reservations] = await Promise.all([
    AiPlanningJob.findOne({ ...scope, runId: run._id }).select('status cancelRequested dispatchedAt projectUpdatedAt reservationMicros leaseExpiresAt').lean(),
    run.planId ? AiPlan.findOne({ ...scope, _id: run.planId, runId: run._id }).select('status digest expiresAt approvedAt tasks.key materializedTaskIds').lean() : null,
    AiBudgetReservation.find({ organizationId: access.organizationId, runId: run._id }).select('budgetId amountMicros state actualMicros').limit(10).lean(),
  ]);
  // Do not return organization-wide usage to project viewers, or add the two reservations as two charges.
  const budgets = await AiBudget.find({ organizationId: access.organizationId, _id: { $in: reservations.map(item => item.budgetId) },
    scopeKey: { $in: ['organization', `project:${String(access.project._id)}`] },
  }).select('scopeKey period').limit(10).lean();
  const byId = new Map(budgets.map(item => [String(item._id), item]));
  return {
    run: { ...summary(run), revision: run.revision, objectiveId: run.objectiveId ? String(run.objectiveId) : null,
      taskId: run.taskId ? String(run.taskId) : null, inputDigest: run.inputDigest, policyDigest: run.policyDigest },
    job: job ? { status: job.status, cancelRequested: job.cancelRequested, dispatchedAt: iso(job.dispatchedAt),
      projectUpdatedAt: job.projectUpdatedAt.toISOString(), reservationMicros: job.reservationMicros, leaseExpiresAt: iso(job.leaseExpiresAt) } : null,
    plan: plan ? { id: String(plan._id), status: plan.status, digest: plan.digest, expiresAt: plan.expiresAt.toISOString(),
      approvedAt: iso(plan.approvedAt), taskCount: plan.tasks.length, materializedTaskIds: plan.materializedTaskIds.map(String) } : null,
    reservations: reservations.map(item => {
      const budget = byId.get(String(item.budgetId));
      return { scope: !budget ? 'unknown' : budget.scopeKey === 'organization' ? 'organization' : 'project',
        period: budget?.period ?? null, amountMicros: item.amountMicros, state: item.state, actualMicros: item.actualMicros ?? null };
    }),
  };
}
export async function getRunEvents(access: ScopeAccess, runId: string, rawAfter: string | null): Promise<AiEventPage> {
  const run = await scopedRun(access, runId);
  const after = parseEventAfter(rawAfter);
  const records = await AiRunEvent.find({ ...scopeFor(access), runId: run._id, sequence: { $gt: after } })
    .select('sequence type summary createdAt').sort({ sequence: 1 }).limit(EVENT_PAGE_SIZE + 1).lean();
  const page = records.slice(0, EVENT_PAGE_SIZE);
  return { events: page.map(item => ({ sequence: item.sequence, type: item.type, summary: item.summary, createdAt: item.createdAt.toISOString() })),
    nextAfter: records.length > EVENT_PAGE_SIZE ? page.at(-1)!.sequence : null };
}
