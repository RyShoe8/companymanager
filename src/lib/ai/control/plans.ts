import 'server-only';
import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { planDraftSchema, type PlanDraft } from '@nucleas/ai-contracts';
import { assertApprovalBinding } from '@nucleas/ai-core/governance';
import { AiPlan, AiRun, AiRunEvent } from '@/lib/models/AiControl';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { validateIncomingTaskArray } from '@/lib/projects/taskArrayGuards';
import { AiHttpError, type requireAiProject } from './access';

export function planDigest(draft: PlanDraft): string {
  return createHash('sha256').update(JSON.stringify(planDraftSchema.parse(draft))).digest('hex');
}

export function buildApprovedTasks(draft: PlanDraft, objectiveId: Types.ObjectId, planId: Types.ObjectId, employeeId?: Types.ObjectId) {
  const validated = planDraftSchema.parse(draft);
  const ids = new Map(validated.tasks.map(task => [task.key, new Types.ObjectId()]));
  const tasks = validated.tasks.map(task => ({
    _id: ids.get(task.key)!, name: task.name, description: task.description,
    acceptanceCriteria: task.acceptanceCriteria,
    dependencyTaskIds: task.dependsOn.map(key => ids.get(key)!),
    objectiveId, aiPlanId: planId,
    status: 'active' as const, assignedToEmployeeIds: [], createdByEmployeeId: employeeId,
  }));
  const error = validateIncomingTaskArray({ previousCount: 0, incomingTasks: tasks, isAppend: true });
  if (error) throw new AiHttpError(400, error);
  return tasks;
}

export async function approvePlan(access: Awaited<ReturnType<typeof requireAiProject>>, planId: string, digest: string) {
  if (!access.canManage) throw new AiHttpError(403, 'A manager or administrator must approve plans.');
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      // Revalidate the human's current membership and approval authority at execution time.
      const member = await User.exists({ _id: access.userId, organizationId: access.organizationId }).session(session);
      const approver = await Employee.exists({ userId: access.userId, organizationId: access.organizationId,
        role: { $in: ['Manager', 'Administrator'] },
      }).session(session);
      if (!member || !approver) throw new AiHttpError(403, 'Approval authority is no longer available.');
      const scope = { organizationId: access.organizationId, projectId: access.project._id };
      const plan = await AiPlan.findOne({ ...scope, _id: planId }).session(session);
      if (!plan) throw new AiHttpError(404, 'Plan not found.');
      const draft = planDraftSchema.parse({ summary: plan.summary, tasks: plan.tasks.map(task => ({
        key: task.key, name: task.name, description: task.description,
        acceptanceCriteria: task.acceptanceCriteria, dependsOn: task.dependsOn,
      })) });
      if (digest !== plan.digest || planDigest(draft) !== plan.digest) throw new AiHttpError(409, 'Plan version changed.');
      if (plan.status === 'approved') return { taskIds: plan.materializedTaskIds.map(String), alreadyApproved: true };
      try {
        assertApprovalBinding({ ...scope, projectId: String(scope.projectId), digest: plan.digest,
          expiresAt: plan.expiresAt, consumed: false }, { ...scope, projectId: String(scope.projectId), digest });
      } catch { throw new AiHttpError(409, 'Plan expired. Create a new draft.'); }
      const tasks = buildApprovedTasks(draft, plan.objectiveId, plan._id, access.employeeId);
      // Append only, never overwrite the human task array. Match the approved snapshot.
      const result = await Project.updateOne({
        _id: access.project._id, userId: { $in: access.ownerIds }, updatedAt: plan.projectUpdatedAt,
      }, { $push: { tasks: { $each: tasks } }, $inc: { __v: 1 } }, { session, runValidators: true });
      if (result.modifiedCount !== 1) throw new AiHttpError(409, 'Project changed. Create and review a fresh plan draft.');
      plan.status = 'approved'; plan.approvedAt = new Date(); plan.approvedByUserId = new Types.ObjectId(access.userId);
      plan.materializedTaskIds = tasks.map(task => task._id);
      await plan.save({ session });
      if (plan.runId) {
        const run = await AiRun.findOneAndUpdate({ _id: plan.runId, ...scope, role: 'architect', status: 'awaiting_acceptance' },
          { $set: { status: 'completed', completedAt: new Date() }, $inc: { revision: 1 } }, { session, new: true });
        if (!run) throw new AiHttpError(409, 'Planning run is no longer ready for acceptance.');
        await AiRunEvent.create([{ ...scope, runId: run._id, sequence: run.revision,
          type: 'run.completed', summary: 'Human approved the generated plan version; project tasks were created. No code was executed.',
        }], { session });
      }
      return { taskIds: tasks.map(task => String(task._id)), alreadyApproved: false };
    });
  } finally { await session.endSession(); }
}
