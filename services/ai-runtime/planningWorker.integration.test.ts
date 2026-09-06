import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { randomUUID } from 'node:crypto';
import { AiBudget, AiBudgetReservation, AiDispatchLock, AiObjective, AiPlan, AiPlanningJob, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import { AiSettings, AiSettingsAudit } from '@/lib/models/AiSettings';
import { defaultPlatformAiSettings } from '@/lib/ai/settingsSchema';
import { platformSettingsId, saveSettings, readPlatformSettings } from '@/lib/ai/control/settings';
import { saveBudgetSettings, budgetSettingsView } from '@/lib/ai/control/budgetSettings';
import { getPlanningPolicy } from '@/lib/ai/control/config';
import { listProjectRuns, getRunDetail, getRunEvents } from '@/lib/ai/control/runQueries';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import { ensureAiIndexes } from '@/lib/ai/control/indexes';
import { queuePlanning, cancelPlanning, type AiAccess } from '@/lib/ai/control/planningQueue';
import { approvePlan } from '@/lib/ai/control/plans';
import { processPlanningQueue } from './planningWorker';
import type { ModelResult } from '@nucleas/ai-contracts';

// Never read .env.local, use production MongoDB, or invoke a real model in this suite.
vi.mock('@/lib/db/mongodb', () => ({ default: async () => mongoose }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/access', () => ({ AiHttpError: class extends Error {
  constructor(public status: number, message: string) { super(message); }
} }));
const model = vi.hoisted(() => vi.fn());
vi.mock('@nucleas/ai-core/gateway', async importOriginal => {
  const actual = await importOriginal<typeof import('@nucleas/ai-core/gateway')>();
  return { ...actual, invokeModel: model };
});

let replica: MongoMemoryReplSet;
let access: AiAccess;
let objective: InstanceType<typeof AiObjective>;
const models = [AiSettings, AiSettingsAudit,AiPlanningJob, AiDispatchLock, AiBudgetReservation, AiBudget, AiRunEvent, AiRun, AiPlan, AiObjective, Project, Employee, User];
const response: ModelResult = { content: JSON.stringify({ summary: 'Synthetic plan', tasks: [{ key: 'test', name: 'Add a regression', acceptanceCriteria: ['Test passes'], dependsOn: [] }] }),
  model: 'synthetic-model', inputTokens: 20, outputTokens: 30, latencyMs: 10, finishReason: 'stop' };

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
    instanceOpts: [{ args: ['--wiredTigerCacheSizeGB', '0.25'] }] });
  await mongoose.connect(replica.getUri('nucleas_ai_test_planning'));
  await ensureAiIndexes();
  await Promise.all([User, Project, Employee].map(item => item.createIndexes()));
}, 180000);
afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); }, 30000);
beforeEach(async () => {
  if (mongoose.connection.host !== '127.0.0.1' || mongoose.connection.name !== 'nucleas_ai_test_planning') throw new Error('Refusing to clear a non-test database.');
  for (const item of models) await item.collection.deleteMany({});
  vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', 'synthetic-only');
  vi.stubEnv('CRON_SECRET', 'synthetic-cron');
  await AiSettings.create({ _id: platformSettingsId, value: { ...defaultPlatformAiSettings,
    remoteEnabled: true, dispatchEnabled: true, model: 'synthetic-model',
    reservationMicros: 25, organizationLimitMicros: 100, projectLimitMicros: 75,
  } });
  model.mockReset(); model.mockResolvedValue(response);
  const user = await User.create({ email: 'ai-test@example.invalid', password: 'synthetic', organizationId: 'org-test' });
  const employee = await Employee.create({ userId: user._id, organizationId: 'org-test', name: 'Test manager', role: 'Manager' });
  const project = await Project.create({ userId: user._id, name: 'Synthetic project', tasks: [
    { name: 'Existing human task', assignedToEmployeeIds: [employee._id, new Types.ObjectId()] },
  ] });
  access = { userId: String(user._id), organizationId: 'org-test', employeeId: employee._id, canManage: true, ownerIds: [user._id], project };
  objective = await AiObjective.create({ organizationId: 'org-test', projectId: project._id, requestId: randomUUID(),
    createdByUserId: user._id, title: 'Synthetic objective', outcome: 'Tests pass', acceptanceCriteria: ['Regression covered'] });
});
afterEach(() => vi.unstubAllEnvs());

describe('durable planning on a real isolated replica set', () => {
  it('paginates tied timestamps without duplicate runs, including when new runs arrive', async () => {
    const createdAt = new Date('2026-09-01T00:00:00Z');
    const records = Array.from({ length: 31 }, () => ({ _id: new Types.ObjectId(), organizationId: access.organizationId,
      projectId: access.project._id, role: 'architect', status: 'blocked', revision: 0, createdAt, updatedAt: createdAt,
      inputDigest: 'a'.repeat(64), policyDigest: 'b'.repeat(64), createdByUserId: new Types.ObjectId(access.userId) }));
    await AiRun.collection.insertMany(records);
    await AiRun.collection.insertOne({ ...records[0], _id: new Types.ObjectId(), organizationId: 'other-org' });
    const first = await listProjectRuns(access, null); expect(first.runs).toHaveLength(25);
    await AiRun.collection.insertOne({ ...records[0], _id: new Types.ObjectId(), createdAt: new Date() });
    const second = await listProjectRuns(access, first.nextCursor);
    expect(second.runs).toHaveLength(6); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.runs, ...second.runs].map(run => run.id)).size).toBe(31);
  });
  it('redacts private job fields and keeps both reservation scopes distinct', async () => {
    const queued = await queuePlanning(access, String(objective._id), randomUUID());
    await AiPlanningJob.updateOne({ runId: queued.runId }, { $set: { leaseToken: 'private-lease', input: 'private-prompt' } });
    const detail = await getRunDetail(access, queued.runId);
    expect(detail.run.costMicros).toBeNull(); expect(detail.run.inputTokens).toBeNull();
    expect(detail.reservations).toHaveLength(2);
    expect(detail.reservations.map(item => item.scope).sort()).toEqual(['organization', 'project']);
    const serialized = JSON.stringify(detail);
    for (const text of ['private-lease', 'private-prompt', 'synthetic-only', 'createdByUserId', 'spentMicros']) expect(serialized).not.toContain(text);
    await expect(getRunDetail({ ...access, organizationId: 'other-org' }, queued.runId)).rejects.toMatchObject({ status: 404 });
    await expect(getRunEvents({ ...access, organizationId: 'other-org' }, queued.runId, null)).rejects.toMatchObject({ status: 404 });
  });
  it('paginates events by sequence and excludes mismatched project events', async () => {
    const queued = await queuePlanning(access, String(objective._id), randomUUID());
    await AiRunEvent.insertMany(Array.from({ length: 60 }, (_, index) => ({ organizationId: access.organizationId,
      projectId: access.project._id, runId: queued.runId, sequence: index + 1, type: 'test.event', summary: 'Synthetic event' })));
    await AiRunEvent.create({ organizationId: access.organizationId, projectId: new Types.ObjectId(), runId: queued.runId,
      sequence: 999, type: 'test.event', summary: 'Must not be exposed' });
    const first = await getRunEvents(access, queued.runId, null);
    expect(first.events).toHaveLength(50); expect(first.nextAfter).toBe(49);
    const second = await getRunEvents(access, queued.runId, String(first.nextAfter));
    expect(second.events).toHaveLength(11); expect(second.nextAfter).toBeNull();
    expect(second.events.map(event => event.sequence)).toEqual(Array.from({ length: 11 }, (_, index) => index + 50));
  });
  it('persists audited settings and rejects concurrent stale saves', async () => {
    const prior = await readPlatformSettings();
    const results = await Promise.all([
      saveSettings(platformSettingsId, prior.revision, { ...prior.value, model: 'model-a' }, access.userId),
      saveSettings(platformSettingsId, prior.revision, { ...prior.value, model: 'model-b' }, access.userId),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await readPlatformSettings()).revision).toBe(1);
    expect(await AiSettingsAudit.countDocuments()).toBe(1);
    expect(JSON.stringify(await AiSettingsAudit.find().lean())).not.toContain('synthetic-only');
  });
  it('honors lower scoped limits without changing another organization', async () => {
    await saveBudgetSettings({ userId: access.userId, organizationId: access.organizationId, projectId: undefined }, 0, { limitMicros: 50 });
    expect((await getPlanningPolicy(access.organizationId, String(access.project._id))).organizationLimitMicros).toBe(50);
    expect((await getPlanningPolicy('another-organization', String(new Types.ObjectId()))).organizationLimitMicros).toBe(100);
    await expect(saveBudgetSettings({ userId: access.userId, organizationId: access.organizationId, projectId: String(access.project._id) }, 0, { limitMicros: 60 })).rejects.toMatchObject({ status: 400 });
  });
  it('supports a zero project limit and clamped inheritance without clearing reservations', async () => {
    const projectAccess = { userId: access.userId, organizationId: access.organizationId, projectId: String(access.project._id) };
    await queuePlanning(access, String(objective._id), randomUUID()); await processPlanningQueue();
    await saveBudgetSettings(projectAccess, 0, { limitMicros: 0 });
    await expect(queuePlanning(access, String(objective._id), randomUUID())).rejects.toThrow();
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 25)).toBe(true);
    await saveBudgetSettings(projectAccess, 1, { limitMicros: null });
    expect((await budgetSettingsView(access.organizationId, projectAccess.projectId)).effectiveLimitMicros).toBe(75);
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 25)).toBe(true);
  });
  it('pauses the worker through saved settings and blocks outdated queued policy after resuming', async () => {
    const queued = await queuePlanning(access, String(objective._id), randomUUID());
    const prior = await readPlatformSettings();
    await saveSettings(platformSettingsId, prior.revision, { ...prior.value, dispatchEnabled: false }, access.userId);
    expect(await processPlanningQueue()).toEqual({ status: 'disabled' });
    expect(model).not.toHaveBeenCalled();
    await saveSettings(platformSettingsId, prior.revision + 1, prior.value, access.userId);
    expect((await processPlanningQueue()).status).toBe('blocked');
    expect((await AiRun.findById(queued.runId))?.failureCode).toBe('stale_input_or_policy');
    expect(model).not.toHaveBeenCalled();
  });
  it('rejects drafts when saved settings change during inference', async () => {
    const queued = await queuePlanning(access, String(objective._id), randomUUID());
    model.mockImplementationOnce(async () => {
      const prior = await readPlatformSettings();
      await saveSettings(platformSettingsId, prior.revision, { ...prior.value, model: 'replacement-model' }, access.userId);
      return response;
    });
    expect((await processPlanningQueue()).status).toBe('blocked');
    expect(await AiPlan.countDocuments({ runId: queued.runId })).toBe(0);
  });
  it('queues once, creates a draft, and materializes tasks only on human approval', async () => {
    const requestId = randomUUID();
    const queued = await queuePlanning(access, String(objective._id), requestId);
    expect(await queuePlanning(access, String(objective._id), requestId)).toMatchObject({ runId: queued.runId, alreadyQueued: true });
    expect(await AiPlanningJob.countDocuments()).toBe(1);
    expect((await Project.findById(access.project._id))?.tasks).toHaveLength(1);
    await processPlanningQueue();
    expect(model).toHaveBeenCalledTimes(1);
    const plan = await AiPlan.findOne({ runId: queued.runId });
    expect(plan?.source).toBe('remote-model');
    expect((await AiRun.findById(queued.runId))?.status).toBe('awaiting_acceptance');
    expect((await Project.findById(access.project._id))?.tasks).toHaveLength(1);
    await approvePlan(access, String(plan!._id), plan!.digest);
    await approvePlan(access, String(plan!._id), plan!.digest);
    const updated = await Project.findById(access.project._id);
    expect(updated?.tasks).toHaveLength(2);
    expect(updated?.tasks?.[0].assignedToEmployeeIds?.map(String)).toEqual(access.project.tasks?.[0].assignedToEmployeeIds?.map(String));
    expect((await AiRun.findById(queued.runId))?.status).toBe('completed');
    expect((await AiRunEvent.find({ runId: queued.runId })).map(event => event.sequence)).toEqual([0, 1, 2, 3]);
  });
  it('serializes concurrent duplicate submissions and leaves one reservation per scope', async () => {
    const requestId = randomUUID();
    const results = await Promise.allSettled([queuePlanning(access, String(objective._id), requestId), queuePlanning(access, String(objective._id), requestId)]);
    expect(results.some(result => result.status === 'fulfilled')).toBe(true);
    expect(await AiPlanningJob.countDocuments()).toBe(1);
    expect(await AiRun.countDocuments()).toBe(1);
    expect(await AiBudgetReservation.countDocuments()).toBe(2);
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 25)).toBe(true);
  });
  it('rolls back run/job creation if the project budget cannot be reserved', async () => {
    await queuePlanning(access, String(objective._id), randomUUID()); await processPlanningQueue();
    await queuePlanning(access, String(objective._id), randomUUID()); await processPlanningQueue();
    await queuePlanning(access, String(objective._id), randomUUID()); await processPlanningQueue();
    await expect(queuePlanning(access, String(objective._id), randomUUID())).rejects.toThrow('Budget unavailable');
    expect(await AiRun.countDocuments()).toBe(3);
    expect(await AiPlanningJob.countDocuments()).toBe(3);
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 75)).toBe(true);
  });
  it('cancels queued work and releases its reservations without inference', async () => {
    const { runId } = await queuePlanning(access, String(objective._id), randomUUID());
    await cancelPlanning(access, runId); await processPlanningQueue();
    expect(model).not.toHaveBeenCalled();
    expect((await AiRun.findById(runId))?.status).toBe('cancelled');
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 0)).toBe(true);
  });
  it('discards returned drafts when cancellation arrives during inference', async () => {
    const { runId } = await queuePlanning(access, String(objective._id), randomUUID());
    model.mockImplementation(async () => { await cancelPlanning(access, runId); return response; });
    await processPlanningQueue();
    expect(await AiPlan.countDocuments()).toBe(0);
    expect((await AiRun.findById(runId))?.status).toBe('cancelled');
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 25)).toBe(true);
  });
  it('blocks stale project snapshots before sending data', async () => {
    const { runId } = await queuePlanning(access, String(objective._id), randomUUID());
    await Project.updateOne({ _id: access.project._id }, { $set: { name: 'Changed' } });
    await processPlanningQueue();
    expect(model).not.toHaveBeenCalled();
    expect((await AiRun.findById(runId))?.failureCode).toBe('stale_input_or_policy');
  });
  it('rechecks revoked membership and never sends an unauthorized objective', async () => {
    await queuePlanning(access, String(objective._id), randomUUID());
    await Employee.updateOne({ _id: access.employeeId }, { $set: { role: 'User' } });
    await processPlanningQueue(); expect(model).not.toHaveBeenCalled(); expect(await AiPlan.countDocuments()).toBe(0);
  });
  it('does not publish a draft if the project changes during inference', async () => {
    await queuePlanning(access, String(objective._id), randomUUID());
    model.mockImplementation(async () => { await Project.updateOne({ _id: access.project._id }, { $set: { name: 'Changed during inference' } }); return response; });
    await processPlanningQueue(); expect(await AiPlan.countDocuments()).toBe(0);
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 25)).toBe(true);
  });
  it('rejects malformed model output without retries or project changes', async () => {
    await queuePlanning(access, String(objective._id), randomUUID());
    model.mockResolvedValue({ ...response, content: 'not JSON' }); await processPlanningQueue();
    expect(model).toHaveBeenCalledTimes(1); expect(await AiPlan.countDocuments()).toBe(0);
    expect((await Project.findById(access.project._id))?.tasks).toHaveLength(1);
  });
  it('fences an expired attempt and retains unknown charges instead of replaying', async () => {
    const { runId } = await queuePlanning(access, String(objective._id), randomUUID());
    await AiPlanningJob.updateOne({ runId }, { $set: { status: 'running', leaseToken: 'expired', leaseExpiresAt: new Date(0), dispatchedAt: new Date(0) } });
    await processPlanningQueue();
    expect(model).not.toHaveBeenCalled();
    expect((await AiRun.findById(runId))?.failureCode).toBe('lease_expired');
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 25)).toBe(true);
  });
  it('prevents overlapping cron invocations', async () => {
    await queuePlanning(access, String(objective._id), randomUUID());
    await AiDispatchLock.create({ _id: 'remote-planning-v1', token: 'held', expiresAt: new Date(Date.now() + 60000) });
    expect(await processPlanningQueue()).toEqual({ status: 'busy' }); expect(model).not.toHaveBeenCalled();
  });
  it('fences a late response after the lease expires', async () => {
    const { runId } = await queuePlanning(access, String(objective._id), randomUUID());
    model.mockImplementation(async () => {
      await AiPlanningJob.updateOne({ runId }, { $set: { leaseExpiresAt: new Date(0) } });
      return response;
    });
    expect((await processPlanningQueue()).status).toBe('lease_lost');
    expect(await AiPlan.countDocuments()).toBe(0);
    await processPlanningQueue();
    expect(model).toHaveBeenCalledTimes(1);
    expect((await AiRun.findById(runId))?.failureCode).toBe('lease_expired');
  });
  it('refuses an objective from another organization without allocating budget', async () => {
    await AiObjective.updateOne({ _id: objective._id }, { $set: { organizationId: 'other-org' } });
    await expect(queuePlanning(access, String(objective._id), randomUUID())).rejects.toMatchObject({ status: 404 });
    expect(await AiRun.countDocuments()).toBe(0); expect(await AiBudgetReservation.countDocuments()).toBe(0);
  });
  it('records an explicit no-provider-fee result separately from unknown pricing', async () => {
    await AiSettings.updateOne({ _id: platformSettingsId }, { $set: { 'value.noProviderFee': true } });
    const { runId } = await queuePlanning(access, String(objective._id), randomUUID()); await processPlanningQueue();
    expect((await AiRun.findById(runId))?.costMicros).toBe(0);
    expect((await AiBudget.find()).every(budget => budget.reservedMicros === 0)).toBe(true);
  });
});
