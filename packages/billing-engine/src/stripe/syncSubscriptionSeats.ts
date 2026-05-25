import mongoose from 'mongoose';
import { isActiveSubscriptionStatus } from '../billing/subscriptionAccess';
import { getEffectiveSeatCount } from '../billing/employeeLimits';
import { connectBillingDb, getBillingContext } from '../context';
import { OrganizationSubscriptionModel } from '../models/OrganizationSubscription';
import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import { getStripe } from './client';
import { persistOrganizationSubscriptionStripeItems } from './subscriptionItemSync';

type OrgSubSeatRow = {
  stripeSubscriptionId: string;
  stripeSeatItemId: string;
  status?: string;
  subscriptionPlanId: SubscriptionPlanDoc | null;
};

export async function syncStripeSubscriptionSeatsForOrganization(
  organizationId: string | mongoose.Types.ObjectId
): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return;
  await connectBillingDb();
  const orgId =
    typeof organizationId === 'string'
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId;

  const orgSub = await OrganizationSubscriptionModel.findOne({ organizationId: orgId })
    .populate('subscriptionPlanId')
    .lean<OrgSubSeatRow>();
  if (!orgSub?.stripeSubscriptionId) return;
  if (!isActiveSubscriptionStatus(orgSub.status)) return;

  const plan = orgSub.subscriptionPlanId;
  if (!plan?.stripeSeatPriceId || plan.interval === 'lifetime') return;

  const ctx = getBillingContext();
  const orgIdStr = orgId.toString();
  if (ctx.seats.beforeCountSeats) {
    await ctx.seats.beforeCountSeats(orgIdStr);
  }
  const count = getEffectiveSeatCount(await ctx.seats.getSeatCount(orgIdStr));
  const additional = Math.max(0, count - (plan.includedUsers ?? 1));
  const stripe = getStripe();
  const subId = orgSub.stripeSubscriptionId;
  const seatItemId = orgSub.stripeSeatItemId;

  if (additional === 0 && !seatItemId) {
    await OrganizationSubscriptionModel.updateOne(
      { organizationId: orgId },
      { $set: { seats: Math.max(1, count) } }
    );
    return;
  }

  if (seatItemId && additional === 0) {
    const updated = await stripe.subscriptions.update(subId, {
      items: [{ id: seatItemId, deleted: true }],
      proration_behavior: 'always_invoice',
    });
    await OrganizationSubscriptionModel.updateOne(
      { organizationId: orgId },
      { $set: { stripeSeatItemId: '', seats: Math.max(1, count) } }
    );
    await persistOrganizationSubscriptionStripeItems(orgId, updated, plan);
    return;
  }

  if (!seatItemId && additional > 0) {
    const updated = await stripe.subscriptions.update(subId, {
      items: [{ price: plan.stripeSeatPriceId, quantity: additional }],
      proration_behavior: 'always_invoice',
    });
    await persistOrganizationSubscriptionStripeItems(orgId, updated, plan);
    await OrganizationSubscriptionModel.updateOne(
      { organizationId: orgId },
      { $set: { seats: Math.max(1, count) } }
    );
    return;
  }

  if (seatItemId) {
    await stripe.subscriptions.update(subId, {
      items: [{ id: seatItemId, quantity: additional }],
      proration_behavior: 'always_invoice',
    });
  }

  await OrganizationSubscriptionModel.updateOne(
    { organizationId: orgId },
    { $set: { seats: Math.max(1, count) } }
  );
}
