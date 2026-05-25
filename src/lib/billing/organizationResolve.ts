import connectDB from '@/lib/db/mongodb';
import Organization, { type IOrganization } from '@/lib/models/Organization';
import User, { type IUser } from '@/lib/models/User';

export type BillingUserOrg = {
  user: IUser;
  org: IOrganization;
};

/** Resolve Organization document for a logged-in user (Nucleas org key = admin userId). */
export async function getOrganizationForBillingUser(
  userId: string
): Promise<BillingUserOrg | null> {
  await connectDB();
  const user = await User.findById(userId);
  if (!user?.organizationId) return null;

  const org = await Organization.findOne({ userId: user.organizationId });
  if (!org) return null;

  return { user, org };
}
