import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import '@/lib/billing-engine';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Invitation from '@/lib/models/Invitation';
import Organization from '@/lib/models/Organization';
import Project from '@/lib/models/Project';
import Meeting from '@/lib/models/Meeting';
import MeetingSeriesSettings from '@/lib/models/MeetingSeriesSettings';
import Recording from '@/lib/models/Recording';
import WorkspaceNotificationEvent from '@/lib/models/WorkspaceNotificationEvent';
import WorkspaceNotificationPreference from '@/lib/models/WorkspaceNotificationPreference';
import PartnerCatalog from '@/lib/models/PartnerCatalog';
import { OrganizationSubscriptionModel, getStripe } from 'billing-engine';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { cleanupProjectMedia } from '@/lib/projects/projectCleanup';
import { deleteBrevoContact } from '@/lib/services/email';
import { AccountDeletionError } from '@/lib/account/accountDeletionError';

async function cancelStripeSubscriptionBestEffort(stripeSubscriptionId?: string | null): Promise<void> {
  const subId = stripeSubscriptionId?.trim();
  if (!subId) return;
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(subId);
  } catch (error) {
    console.error('teardownOrganization: Stripe cancel failed', subId, error);
  }
}

/** Delete all data for an organization (org admin userId = organizationId on users). */
export async function teardownOrganization(organizationId: string): Promise<void> {
  await connectDB();

  const orgAdminId = organizationId;
  const orgUserIds = await getOrganizationUserIds(orgAdminId, organizationId);
  const orgUsers = await User.find({ organizationId }).select('_id email').lean();
  const userEmails = orgUsers.map((u) => u.email).filter(Boolean);

  const orgDoc = await Organization.findOne({ userId: orgAdminId });
  if (orgDoc?.stripeSubscriptionId) {
    await cancelStripeSubscriptionBestEffort(orgDoc.stripeSubscriptionId);
  }

  const projects = await Project.find({ userId: { $in: orgUserIds } }).lean();
  for (const project of projects) {
    const projectId = project._id.toString();
    await cleanupProjectMedia(projectId, project, organizationId);
    await Project.deleteOne({ _id: project._id });
  }

  await Employee.deleteMany({ organizationId });
  await Invitation.deleteMany({ organizationId });
  await Meeting.deleteMany({ organizationId });
  await MeetingSeriesSettings.deleteMany({ organizationId });
  await WorkspaceNotificationEvent.deleteMany({ organizationId });
  await WorkspaceNotificationPreference.deleteMany({ organizationId });

  if (orgDoc) {
    await Recording.deleteMany({ organizationId: orgDoc._id });
    await OrganizationSubscriptionModel.deleteMany({ organizationId: orgDoc._id });
    await Organization.deleteOne({ _id: orgDoc._id });
  }

  await PartnerCatalog.deleteMany({ userId: new Types.ObjectId(orgAdminId) });
  await User.deleteMany({ organizationId });

  for (const email of userEmails) {
    try {
      await deleteBrevoContact(email);
    } catch {
      // best-effort
    }
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await connectDB();

  const user = await User.findById(userId);
  if (!user) {
    throw new AccountDeletionError('User not found', 404);
  }

  const orgId = user.organizationId;
  const orgUserCount = await User.countDocuments({ organizationId: orgId });
  const isOrgAdmin = user._id.toString() === orgId;

  if (orgUserCount === 1) {
    await teardownOrganization(orgId);
    return;
  }

  if (isOrgAdmin) {
    throw new AccountDeletionError(
      'Remove all team members before deleting your organization owner account.',
      409
    );
  }

  await Invitation.deleteMany({
    $or: [{ invitedBy: user._id }, { email: user.email.toLowerCase() }],
  });
  await Employee.deleteMany({
    $or: [{ userId: user._id }, { email: user.email.toLowerCase() }],
  });

  try {
    await deleteBrevoContact(user.email);
  } catch {
    // best-effort
  }

  await User.findByIdAndDelete(userId);
}
