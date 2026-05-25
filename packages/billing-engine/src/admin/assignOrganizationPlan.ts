import mongoose from 'mongoose';
import { getEffectiveSeatCount } from '../billing/employeeLimits';
import { connectBillingDb, getBillingContext, getOrganizationModel } from '../context';
import { OrganizationSubscriptionModel } from '../models/OrganizationSubscription';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

export async function assignOrganizationPlan(
  orgId: mongoose.Types.ObjectId,
  planId: mongoose.Types.ObjectId,
  subscriptionStatus?: string
): Promise<void> {
  await connectBillingDb();
  const ctx = getBillingContext();
  const plan = await SubscriptionPlanModel.findById(planId).lean();
  if (!plan || plan.archived) {
    throw new Error('Plan not found or archived');
  }

  const orgIdStr = orgId.toString();
  if (ctx.seats.beforeCountSeats) {
    await ctx.seats.beforeCountSeats(orgIdStr);
  }
  const seatCount = getEffectiveSeatCount(await ctx.seats.getSeatCount(orgIdStr));
  const status =
    subscriptionStatus && subscriptionStatus !== 'none' ? subscriptionStatus : 'active';

  await OrganizationSubscriptionModel.findOneAndUpdate(
    { organizationId: orgId },
    {
      $set: {
        subscriptionPlanId: planId,
        status,
        seats: seatCount,
        grandfathered: true,
        startedAt: new Date(),
      },
    },
    { upsert: true }
  );

  const OrganizationModel = getOrganizationModel();
  await OrganizationModel.findByIdAndUpdate(orgId, {
    $set: {
      plan: String(plan.slug),
      subscriptionStatus: status,
    },
  });
}
