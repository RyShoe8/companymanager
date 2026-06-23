import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Client from '@/lib/models/Client';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import {
  getProjectTeamEmployeeIds,
  getTaskAssigneeEmployeeIds,
} from '@/lib/utils/projectTeam';
import { Types } from 'mongoose';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeEmail(email: string): string | null {
  const t = email.trim().toLowerCase();
  if (!t || !EMAIL_RE.test(t)) return null;
  return t;
}

async function emailsForEmployeeIds(
  organizationId: string,
  employeeIds: Iterable<string>,
  excludeEmail?: string | null
): Promise<string[]> {
  const ids = [...new Set([...employeeIds].filter((id) => Types.ObjectId.isValid(id)))];
  if (ids.length === 0) return [];

  const employees = await Employee.find({
    organizationId,
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
  }).lean();

  const userIds = employees
    .map((e) => e.userId)
    .filter((id): id is Types.ObjectId => id != null);

  const users =
    userIds.length > 0
      ? await User.find({ _id: { $in: userIds } }).select('email').lean()
      : [];
  const emailByUserId = new Map(users.map((u) => [u._id.toString(), u.email?.toLowerCase()]));

  const emails: string[] = [];
  const seen = new Set<string>();
  for (const emp of employees) {
    const raw =
      (emp.userId && emailByUserId.get(emp.userId.toString())) || emp.email || '';
    const email = normalizeEmail(raw);
    if (!email || (excludeEmail && email === excludeEmail)) continue;
    if (!seen.has(email)) {
      seen.add(email);
      emails.push(email);
    }
  }
  return emails;
}

async function emailsForClient(
  clientId: string,
  excludeEmail?: string | null
): Promise<string[]> {
  if (!Types.ObjectId.isValid(clientId)) return [];
  const client = await Client.findById(clientId).lean();
  if (!client) return [];

  const emails: string[] = [];
  const seen = new Set<string>();

  const contact = normalizeEmail(client.contactEmail ?? '');
  if (contact && contact !== excludeEmail && !seen.has(contact)) {
    seen.add(contact);
    emails.push(contact);
  }

  const userIds = (client.userIds ?? []).filter((id): id is Types.ObjectId => id != null);
  if (userIds.length > 0) {
    const users = await User.find({ _id: { $in: userIds } }).select('email').lean();
    for (const user of users) {
      const email = normalizeEmail(user.email ?? '');
      if (!email || (excludeEmail && email === excludeEmail) || seen.has(email)) continue;
      seen.add(email);
      emails.push(email);
    }
  }

  return emails;
}

export async function resolveShareEmailsForAssetLink(options: {
  linkedProjectId?: string;
  linkedClientId?: string;
  actingUserId: string;
}): Promise<string[]> {
  await connectDB();

  const actingUser = await User.findById(options.actingUserId).select('email organizationId').lean();
  const excludeEmail = actingUser?.email?.toLowerCase() ?? null;
  const orgId = actingUser?.organizationId?.toString();
  if (!orgId) return [];

  const emails = new Set<string>();

  const addEmails = (list: string[]) => {
    for (const email of list) emails.add(email);
  };

  if (options.linkedProjectId && Types.ObjectId.isValid(options.linkedProjectId)) {
    const project = await Project.findById(options.linkedProjectId).lean();
    if (project) {
      const employeeIds = new Set<string>(getProjectTeamEmployeeIds(project));
      for (const task of project.tasks ?? []) {
        for (const id of getTaskAssigneeEmployeeIds(task)) {
          employeeIds.add(id);
        }
      }
      addEmails(await emailsForEmployeeIds(orgId, employeeIds, excludeEmail));

      if (project.clientId) {
        const clientId = project.clientId.toString();
        addEmails(await emailsForClient(clientId, excludeEmail));
        for (const raw of project.invitedClientEmails ?? []) {
          const email = normalizeEmail(String(raw));
          if (email && email !== excludeEmail) emails.add(email);
        }
      }
    }
  } else if (options.linkedClientId && Types.ObjectId.isValid(options.linkedClientId)) {
    addEmails(await emailsForClient(options.linkedClientId, excludeEmail));

    const projects = await Project.find({ clientId: options.linkedClientId }).lean();
    const employeeIds = new Set<string>();
    for (const project of projects) {
      for (const id of getProjectTeamEmployeeIds(project)) {
        employeeIds.add(id);
      }
      for (const task of project.tasks ?? []) {
        for (const id of getTaskAssigneeEmployeeIds(task)) {
          employeeIds.add(id);
        }
      }
    }
    addEmails(await emailsForEmployeeIds(orgId, employeeIds, excludeEmail));
  }

  return [...emails];
}
