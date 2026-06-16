import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { getSession } from '@/lib/auth/session';

/** CTA href for a pricing plan card (register vs billing checkout). */
export async function pricingPlanCtaHref(
  planId: string,
  billingInterval: 'month' | 'year' = 'month'
): Promise<string> {
  const intervalParam =
    billingInterval === 'year' ? `&interval=${encodeURIComponent(billingInterval)}` : '';
  const session = await getSession();
  if (!session?.userId) {
    return `/register?plan=${encodeURIComponent(planId)}${intervalParam}`;
  }

  await connectDB();
  const user = await User.findById(session.userId);
  if (!user) {
    return `/register?plan=${encodeURIComponent(planId)}${intervalParam}`;
  }

  const isOrgOwner = user._id.toString() === user.organizationId;
  if (isOrgOwner) {
    return `/billing?plan=${encodeURIComponent(planId)}${intervalParam}`;
  }

  return '/billing';
}
