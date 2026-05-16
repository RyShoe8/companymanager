import { Types } from 'mongoose';
import Invitation, { IInvitation } from '@/lib/models/Invitation';
import Organization from '@/lib/models/Organization';
import { IEmployee, EmployeeRole, EmployeeTeam, EmployeeType } from '@/lib/models/Employee';
import { IUser } from '@/lib/models/User';
import { generateInvitationToken, getInvitationLink } from '@/lib/utils/invitation';
import { formatBrevoError, logBrevoError, sendInvitationEmail } from '@/lib/services/email';

export interface EmailSendResult {
  emailSent: boolean;
  emailError?: string;
}

export interface EnsureInvitationParams {
  employee: IEmployee;
  inviterUserId: string | Types.ObjectId;
  emailChanged?: boolean;
}

/**
 * Create or refresh a pending invitation for an employee without a linked user account.
 */
export async function ensureInvitationForEmployee(
  params: EnsureInvitationParams
): Promise<IInvitation> {
  const { employee, inviterUserId, emailChanged } = params;

  if (!employee.email) {
    throw new Error('Employee email is required for invitation');
  }

  const email = employee.email.toLowerCase();
  const organizationId = employee.organizationId;

  if (emailChanged) {
    await Invitation.updateMany(
      {
        employeeId: employee._id,
        organizationId,
        status: 'pending',
      },
      { status: 'expired' }
    );
  }

  const token = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  let invitation = await Invitation.findOne({
    employeeId: employee._id,
    organizationId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });

  if (invitation) {
    invitation.token = token;
    invitation.email = email;
    invitation.role = employee.role as EmployeeRole;
    invitation.jobTitle = employee.jobTitle;
    invitation.team = employee.team as EmployeeTeam | undefined;
    invitation.weeklyHours = employee.weeklyHours;
    invitation.employeeType = employee.employeeType as EmployeeType;
    invitation.expiresAt = expiresAt;
    await invitation.save();
    return invitation;
  }

  const existingByEmail = await Invitation.findOne({
    email,
    organizationId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });

  if (existingByEmail && !emailChanged) {
    existingByEmail.employeeId = employee._id;
    existingByEmail.token = token;
    existingByEmail.role = employee.role as EmployeeRole;
    existingByEmail.jobTitle = employee.jobTitle;
    existingByEmail.team = employee.team as EmployeeTeam | undefined;
    existingByEmail.weeklyHours = employee.weeklyHours;
    existingByEmail.employeeType = employee.employeeType as EmployeeType;
    existingByEmail.expiresAt = expiresAt;
    await existingByEmail.save();
    return existingByEmail;
  }

  invitation = await Invitation.create({
    email,
    token,
    organizationId,
    employeeId: employee._id,
    role: employee.role,
    jobTitle: employee.jobTitle,
    team: employee.team,
    weeklyHours: employee.weeklyHours,
    employeeType: employee.employeeType,
    expiresAt,
    status: 'pending',
    invitedBy: inviterUserId,
  });

  return invitation;
}

/**
 * Send the invitation email for an existing invitation record.
 */
export async function sendEmployeeInvitationEmail(params: {
  invitation: IInvitation;
  employee: IEmployee;
  inviterUser: IUser;
}): Promise<EmailSendResult> {
  const { invitation, employee, inviterUser } = params;

  if (!employee.email) {
    return { emailSent: false, emailError: 'Employee has no email address' };
  }

  try {
    const organization = await Organization.findOne({ userId: inviterUser.organizationId });
    const organizationName = organization?.name || 'the organization';
    const invitationLink = getInvitationLink(invitation.token);

    await sendInvitationEmail({
      recipientEmail: employee.email.toLowerCase(),
      recipientName: employee.name,
      inviterName: inviterUser.name || inviterUser.email,
      organizationName,
      invitationLink,
      role: invitation.role,
      expiresInDays: 7,
    });

    return { emailSent: true };
  } catch (error: unknown) {
    logBrevoError('Failed to send employee invitation email', error);
    return { emailSent: false, emailError: formatBrevoError(error) };
  }
}

/**
 * Ensure invitation exists (refresh token/expiry) and send invite email.
 */
export async function inviteEmployeeByEmail(params: {
  employee: IEmployee;
  inviterUser: IUser;
  inviterUserId: string | Types.ObjectId;
  emailChanged?: boolean;
}): Promise<{ invitation: IInvitation } & EmailSendResult> {
  const invitation = await ensureInvitationForEmployee({
    employee: params.employee,
    inviterUserId: params.inviterUserId,
    emailChanged: params.emailChanged,
  });

  const emailResult = await sendEmployeeInvitationEmail({
    invitation,
    employee: params.employee,
    inviterUser: params.inviterUser,
  });

  return { invitation, ...emailResult };
}
