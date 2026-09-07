import 'server-only';
import type { ClientSession, Types } from 'mongoose';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import WorkspaceNotificationEvent, { type IWorkspaceNotificationEvent } from '@/lib/models/WorkspaceNotificationEvent';
import WorkspaceNotificationPreference from '@/lib/models/WorkspaceNotificationPreference';
import { AiRun } from '@/lib/models/AiControl';

async function eligibleRecipient(userId: Types.ObjectId, organizationId: string, projectId: Types.ObjectId, session?: ClientSession) {
  const member = await User.exists({ _id: userId, organizationId }).session(session ?? null);
  const employee = await Employee.findOne({ userId, organizationId, role: { $in: ['Manager', 'Administrator'] } }).select('_id').session(session ?? null);
  const project = await Project.findById(projectId).select('userId').session(session ?? null);
  if (!member || !employee || !project) return null;
  if (!await User.exists({ _id: project.userId, organizationId }).session(session ?? null)) return null;
  const preference = await WorkspaceNotificationPreference.exists({ userId, organizationId, employeeId: employee._id, interval: { $ne: 'off' } }).session(session ?? null);
  return preference ? employee : null;
}

/** Called in the terminal run transaction, so notification enqueue cannot outlive a rolled-back result. */
export async function enqueuePlanningNotification(run: InstanceType<typeof AiRun>, session: ClientSession) {
  if (run.status !== 'awaiting_acceptance' && run.status !== 'blocked') return;
  const employee = await eligibleRecipient(run.createdByUserId, run.organizationId, run.projectId, session);
  if (!employee) return;
  await WorkspaceNotificationEvent.create([{ recipientUserId: run.createdByUserId, recipientEmployeeId: employee._id,
    organizationId: run.organizationId, projectId: run.projectId, projectName: 'AI planning',
    eventType: 'ai_update', entityKind: 'project', entityId: String(run._id), aiRunRevision: run.revision,
    entityLabel: 'AI planning update', changeLabel: run.status === 'awaiting_acceptance' ? 'Draft ready for your review' : 'Planning blocked; review required',
  }], { session });
}

/** Recheck at delivery; stale/revoked updates never expose project or objective text. */
export async function canDeliverPlanningNotification(event: Pick<IWorkspaceNotificationEvent,
  'recipientUserId' | 'organizationId' | 'projectId' | 'entityId' | 'aiRunRevision'>) {
  if (!event.entityId || !/^[a-f\d]{24}$/i.test(event.entityId) || event.aiRunRevision === undefined) return false;
  const run = await AiRun.exists({ _id: event.entityId, organizationId: event.organizationId, projectId: event.projectId,
    createdByUserId: event.recipientUserId, revision: event.aiRunRevision, status: { $in: ['awaiting_acceptance', 'blocked'] } });
  return !!run && !!await eligibleRecipient(event.recipientUserId, event.organizationId, event.projectId);
}
