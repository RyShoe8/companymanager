import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Employee, { type EmployeeRole, type IEmployee } from '@/lib/models/Employee';
import User from '@/lib/models/User';
import WorkspaceNotificationEvent, {
  type IWorkspaceNotificationEvent,
} from '@/lib/models/WorkspaceNotificationEvent';
import WorkspaceNotificationPreference from '@/lib/models/WorkspaceNotificationPreference';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import { getAppBaseUrl } from '@/lib/utils/appBaseUrl';
import {
  getProjectTeamEmployeeIds,
  getTaskAssigneeEmployeeIds,
} from '@/lib/utils/projectTeam';
import {
  intervalToMinutes,
  type WorkspaceDigestInterval,
  type WorkspaceEntityKind,
  type WorkspaceNotificationEventType,
} from '@/lib/workspace/notificationTypes';
import { sendWorkspaceDigestEmail } from '@/lib/services/workspaceDigestEmail';

type TaskLike = {
  _id?: { toString(): string } | string;
  name?: string;
  description?: string;
  status?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  estimatedHours?: number | null;
  assignedTo?: string;
  assignedToEmployeeId?: { toString(): string } | string | null;
  assignedToEmployeeIds?: Array<{ toString(): string } | string>;
};

type ProjectLike = {
  _id?: { toString(): string } | string;
  name?: string;
  description?: string;
  status?: string;
  assignedToEmployeeId?: { toString(): string } | string | null;
  assignedToEmployeeIds?: Array<{ toString(): string } | string>;
};

type ContentLike = {
  _id?: { toString(): string } | string;
  title?: string;
  channel?: string;
  status?: string;
  notes?: string;
  publishDate?: Date | string | null;
  assignedToEmployeeId?: { toString(): string } | string | null;
  estimatedHours?: number | null;
};

export type DigestEventRow = {
  eventType: WorkspaceNotificationEventType;
  projectId: string;
  projectName: string;
  entityKind: WorkspaceEntityKind;
  entityId?: string;
  entityLabel: string;
  taskIndex?: number;
  changeLabel: string;
  href: string;
};

function normalizeId(id: unknown): string | null {
  if (id == null || id === '') return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id !== null && 'toString' in id) {
    return (id as { toString(): string }).toString();
  }
  return String(id);
}

function isManagerRole(role: EmployeeRole | undefined): boolean {
  return role === 'Manager' || role === 'Administrator';
}

function taskSignature(task: TaskLike): string {
  return JSON.stringify({
    name: task.name ?? '',
    description: task.description ?? '',
    status: task.status ?? '',
    startDate: task.startDate ?? '',
    endDate: task.endDate ?? '',
    estimatedHours: task.estimatedHours ?? null,
    assigned: getTaskAssigneeEmployeeIds(task as Parameters<typeof getTaskAssigneeEmployeeIds>[0]).sort(),
  });
}

function projectTeamSignature(project: ProjectLike): string {
  return JSON.stringify([...getProjectTeamEmployeeIds(project)].sort());
}

function projectFieldsSignature(project: ProjectLike): string {
  return JSON.stringify({
    name: project.name ?? '',
    description: project.description ?? '',
    status: project.status ?? '',
    team: projectTeamSignature(project),
  });
}

export function taskChanged(before: TaskLike | null | undefined, after: TaskLike): boolean {
  if (!before) return true;
  return taskSignature(before) !== taskSignature(after);
}

export function projectFieldsChanged(
  before: ProjectLike | null | undefined,
  after: ProjectLike
): boolean {
  if (!before) return true;
  return projectFieldsSignature(before) !== projectFieldsSignature(after);
}

export function contentChanged(
  before: ContentLike | null | undefined,
  after: ContentLike
): boolean {
  if (!before) return true;
  return JSON.stringify({
    title: before.title ?? '',
    channel: before.channel ?? '',
    status: before.status ?? '',
    notes: before.notes ?? '',
    publishDate: before.publishDate ?? '',
    assignedToEmployeeId: normalizeId(before.assignedToEmployeeId) ?? '',
    estimatedHours: before.estimatedHours ?? null,
  }) !== JSON.stringify({
    title: after.title ?? '',
    channel: after.channel ?? '',
    status: after.status ?? '',
    notes: after.notes ?? '',
    publishDate: after.publishDate ?? '',
    assignedToEmployeeId: normalizeId(after.assignedToEmployeeId) ?? '',
    estimatedHours: after.estimatedHours ?? null,
  });
}

export function resolveTaskRecipientEmployeeIds(task: TaskLike): string[] {
  return getTaskAssigneeEmployeeIds(task as Parameters<typeof getTaskAssigneeEmployeeIds>[0]);
}

/** Task assignees plus managers/admins on the project team (for status/update notifications). */
export function resolveTaskStatusNotificationEmployeeIds(
  task: TaskLike,
  project: ProjectLike,
  employeesById: Map<string, Pick<IEmployee, 'role'>>
): string[] {
  const assignees = resolveTaskRecipientEmployeeIds(task);
  const managers = resolveProjectRecipientEmployeeIds(project, employeesById);
  return [...new Set([...assignees, ...managers])];
}

export function resolveContentRecipientEmployeeIds(content: ContentLike): string[] {
  const id = normalizeId(content.assignedToEmployeeId);
  return id ? [id] : [];
}

export function resolveProjectRecipientEmployeeIds(
  project: ProjectLike,
  employeesById: Map<string, Pick<IEmployee, 'role'>>
): string[] {
  const teamIds = [...getProjectTeamEmployeeIds(project)];
  return teamIds.filter((employeeId) => {
    const employee = employeesById.get(employeeId);
    return employee ? isManagerRole(employee.role) : false;
  });
}

export function buildWorkspaceDeepLink(options: {
  baseUrl: string;
  projectId: string;
  taskId?: string | null;
  contentId?: string | null;
}): string {
  const url = new URL('/workspace', options.baseUrl);
  url.searchParams.set('project', options.projectId);
  if (options.taskId) url.searchParams.set('task', options.taskId);
  if (options.contentId) url.searchParams.set('content', options.contentId);
  return url.toString();
}

export function eventToDigestRow(
  event: Pick<
    IWorkspaceNotificationEvent,
    | 'eventType'
    | 'projectId'
    | 'projectName'
    | 'entityKind'
    | 'entityId'
    | 'entityLabel'
    | 'taskIndex'
    | 'changeLabel'
  >,
  baseUrl: string
): DigestEventRow {
  const projectId = normalizeId(event.projectId) ?? '';
  const href =
    event.entityKind === 'project'
      ? buildWorkspaceDeepLink({ baseUrl, projectId })
      : event.entityKind === 'task'
        ? buildWorkspaceDeepLink({ baseUrl, projectId, taskId: event.entityId ?? undefined })
        : buildWorkspaceDeepLink({ baseUrl, projectId, contentId: event.entityId ?? undefined });

  return {
    eventType: event.eventType,
    projectId,
    projectName: event.projectName,
    entityKind: event.entityKind,
    entityId: event.entityId,
    entityLabel: event.entityLabel,
    taskIndex: event.taskIndex,
    changeLabel: event.changeLabel,
    href,
  };
}

export function groupDigestRowsByProject(rows: DigestEventRow[]): Map<string, DigestEventRow[]> {
  const grouped = new Map<string, DigestEventRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.projectId) ?? [];
    list.push(row);
    grouped.set(row.projectId, list);
  }
  return grouped;
}

export function isDigestDue(
  interval: WorkspaceDigestInterval,
  lastDigestSentAt: Date | null | undefined,
  now: Date
): boolean {
  const minutes = intervalToMinutes(interval);
  if (minutes == null) return false;
  if (!lastDigestSentAt) return true;
  return now.getTime() - lastDigestSentAt.getTime() >= minutes * 60 * 1000;
}

async function getDeliverableEmail(employee: IEmployee): Promise<string | null> {
  if (employee.userId) {
    const user = await User.findById(employee.userId).lean();
    if (user?.email) return user.email;
  }
  return employee.email?.trim() || null;
}

async function enqueueForEmployeeIds(options: {
  employeeIds: string[];
  actorUserId?: string;
  actorEmployeeId?: string | null;
  organizationId: string;
  eventType: WorkspaceNotificationEventType;
  projectId: string;
  projectName: string;
  entityKind: WorkspaceEntityKind;
  entityId?: string;
  entityLabel: string;
  taskIndex?: number;
  changeLabel: string;
}): Promise<void> {
  const uniqueIds = [...new Set(options.employeeIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  await connectDB();

  const employees = await Employee.find({ _id: { $in: uniqueIds } });
  const employeeById = new Map(employees.map((e) => [e._id.toString(), e]));

  for (const employeeId of uniqueIds) {
    if (options.actorEmployeeId && employeeId === options.actorEmployeeId) continue;

    const employee = employeeById.get(employeeId);
    if (!employee?.userId) continue;

    const userId = employee.userId.toString();
    const pref = await WorkspaceNotificationPreference.findOne({ userId }).lean();
    const interval = (pref?.interval as WorkspaceDigestInterval | undefined) ?? 'off';
    if (interval === 'off') continue;

    await WorkspaceNotificationEvent.create({
      recipientUserId: employee.userId,
      recipientEmployeeId: employee._id,
      organizationId: options.organizationId,
      actorUserId: options.actorUserId ? new Types.ObjectId(options.actorUserId) : undefined,
      eventType: options.eventType,
      projectId: new Types.ObjectId(options.projectId),
      projectName: options.projectName,
      entityKind: options.entityKind,
      entityId: options.entityId,
      entityLabel: options.entityLabel,
      taskIndex: options.taskIndex,
      changeLabel: options.changeLabel,
    });
  }
}

export async function notifyTaskChange(options: {
  project: ProjectLike & Pick<IProject, '_id' | 'name'>;
  task: TaskLike;
  taskIndex?: number;
  actorUserId: string;
  actorEmployeeId?: string | null;
  organizationId: string;
  isNew: boolean;
  changeLabel?: string;
}): Promise<void> {
  const projectId = normalizeId(options.project._id);
  if (!projectId) return;

  const taskId = normalizeId(options.task._id) ?? undefined;
  let recipients = resolveTaskRecipientEmployeeIds(options.task);

  if (!options.isNew) {
    await connectDB();
    const teamIds = [...getProjectTeamEmployeeIds(options.project)];
    const employees = await Employee.find({ _id: { $in: teamIds } });
    const employeesById = new Map(employees.map((e) => [e._id.toString(), e]));
    recipients = resolveTaskStatusNotificationEmployeeIds(
      options.task,
      options.project,
      employeesById
    );
  }

  await enqueueForEmployeeIds({
    employeeIds: recipients,
    actorUserId: options.actorUserId,
    actorEmployeeId: options.actorEmployeeId,
    organizationId: options.organizationId,
    eventType: options.isNew ? 'task_new' : 'task_update',
    projectId,
    projectName: options.project.name,
    entityKind: 'task',
    entityId: taskId,
    entityLabel: options.task.name?.trim() || 'Untitled task',
    taskIndex: options.taskIndex,
    changeLabel: options.changeLabel ?? (options.isNew ? 'New task assigned' : 'Task updated'),
  });
}

export async function notifyContentChange(options: {
  project: Pick<IProject, '_id' | 'name'>;
  content: ContentLike;
  actorUserId: string;
  actorEmployeeId?: string | null;
  organizationId: string;
  isNew: boolean;
  changeLabel?: string;
}): Promise<void> {
  const projectId = normalizeId(options.project._id);
  const contentId = normalizeId(options.content._id);
  if (!projectId || !contentId) return;

  await enqueueForEmployeeIds({
    employeeIds: resolveContentRecipientEmployeeIds(options.content),
    actorUserId: options.actorUserId,
    actorEmployeeId: options.actorEmployeeId,
    organizationId: options.organizationId,
    eventType: options.isNew ? 'content_new' : 'content_update',
    projectId,
    projectName: options.project.name,
    entityKind: 'content',
    entityId: contentId,
    entityLabel: options.content.title?.trim() || 'Untitled content',
    changeLabel: options.changeLabel ?? (options.isNew ? 'New content assigned' : 'Content updated'),
  });
}

export async function notifyProjectChange(options: {
  project: ProjectLike;
  actorUserId: string;
  actorEmployeeId?: string | null;
  organizationId: string;
  isNew: boolean;
  changeLabel?: string;
}): Promise<void> {
  const projectId = normalizeId(options.project._id);
  if (!projectId || !options.project.name) return;

  await connectDB();
  const teamIds = [...getProjectTeamEmployeeIds(options.project)];
  const employees = await Employee.find({ _id: { $in: teamIds } });
  const employeesById = new Map(employees.map((e) => [e._id.toString(), e]));
  const managerRecipients = resolveProjectRecipientEmployeeIds(options.project, employeesById);

  await enqueueForEmployeeIds({
    employeeIds: managerRecipients,
    actorUserId: options.actorUserId,
    actorEmployeeId: options.actorEmployeeId,
    organizationId: options.organizationId,
    eventType: options.isNew ? 'project_new' : 'project_update',
    projectId,
    projectName: options.project.name,
    entityKind: 'project',
    entityId: projectId,
    entityLabel: options.project.name,
    changeLabel: options.changeLabel ?? (options.isNew ? 'New project assigned' : 'Project updated'),
  });
}

export async function notifyProjectPutChanges(options: {
  beforeProject: ProjectLike & { tasks?: TaskLike[] };
  afterProject: ProjectLike & { tasks?: TaskLike[] };
  actorUserId: string;
  actorEmployeeId?: string | null;
  organizationId: string;
}): Promise<void> {
  const { beforeProject, afterProject, actorUserId, actorEmployeeId, organizationId } = options;
  const projectId = normalizeId(afterProject._id);
  if (!projectId || !afterProject.name) return;

  if (projectFieldsChanged(beforeProject, afterProject)) {
    await notifyProjectChange({
      project: afterProject,
      actorUserId,
      actorEmployeeId,
      organizationId,
      isNew: false,
      changeLabel: 'Project updated',
    });
  }

  const beforeById = new Map<string, { task: TaskLike; index: number }>();
  (beforeProject.tasks ?? []).forEach((task, index) => {
    const id = normalizeId(task._id);
    if (id) beforeById.set(id, { task, index });
  });

  (afterProject.tasks ?? []).forEach((task, index) => {
    const id = normalizeId(task._id);
    if (!id) return;
    const before = beforeById.get(id);
    if (!before) {
      void notifyTaskChange({
        project: afterProject as Pick<IProject, '_id' | 'name'>,
        task,
        taskIndex: index,
        actorUserId,
        actorEmployeeId,
        organizationId,
        isNew: true,
        changeLabel: 'New task assigned',
      }).catch((err) => console.error('[workspaceNotifications] task_new', err));
      return;
    }
    if (taskChanged(before.task, task)) {
      void notifyTaskChange({
        project: afterProject as Pick<IProject, '_id' | 'name'>,
        task,
        taskIndex: index,
        actorUserId,
        actorEmployeeId,
        organizationId,
        isNew: false,
        changeLabel: 'Task updated',
      }).catch((err) => console.error('[workspaceNotifications] task_update', err));
    }
  });
}

export async function processWorkspaceNotificationDigests(now = new Date()): Promise<{
  usersProcessed: number;
  emailsSent: number;
  eventsSent: number;
}> {
  await connectDB();
  const baseUrl = getAppBaseUrl();

  const prefs = await WorkspaceNotificationPreference.find({ interval: { $ne: 'off' } }).lean();
  let usersProcessed = 0;
  let emailsSent = 0;
  let eventsSent = 0;

  for (const pref of prefs) {
    const interval = pref.interval as WorkspaceDigestInterval;
    if (!isDigestDue(interval, pref.lastDigestSentAt, now)) continue;

    const pending = await WorkspaceNotificationEvent.find({
      recipientUserId: pref.userId,
      $or: [{ digestSentAt: null }, { digestSentAt: { $exists: false } }],
    })
      .sort({ createdAt: 1 })
      .lean();

    if (pending.length === 0) continue;

    const user = await User.findById(pref.userId).lean();
    if (!user?.email) continue;

    const rows = pending.map((event) => eventToDigestRow(event, baseUrl));
    await sendWorkspaceDigestEmail({
      to: user.email,
      recipientName: user.name,
      events: rows,
      baseUrl,
    });

    const sentAt = new Date();
    await WorkspaceNotificationEvent.updateMany(
      { _id: { $in: pending.map((e) => e._id) } },
      { $set: { digestSentAt: sentAt } }
    );
    await WorkspaceNotificationPreference.updateOne(
      { _id: pref._id },
      { $set: { lastDigestSentAt: sentAt } }
    );

    usersProcessed += 1;
    emailsSent += 1;
    eventsSent += pending.length;
  }

  return { usersProcessed, emailsSent, eventsSent };
}
