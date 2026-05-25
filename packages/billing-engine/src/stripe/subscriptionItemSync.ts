import type Stripe from 'stripe';
import mongoose from 'mongoose';
import { OrganizationSubscriptionModel } from '../models/OrganizationSubscription';
import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';

export function extractBaseAndSeatItemIds(
  sub: Stripe.Subscription,
  plan: Pick<SubscriptionPlanDoc, 'stripeBasePriceId' | 'stripeSeatPriceId'>
): { baseItemId: string; seatItemId: string } {
  let baseItemId = '';
  let seatItemId = '';
  for (const item of sub.items.data) {
    const pid = typeof item.price === 'string' ? item.price : item.price?.id;
    if (pid === plan.stripeBasePriceId) baseItemId = item.id;
    if (plan.stripeSeatPriceId && pid === plan.stripeSeatPriceId) seatItemId = item.id;
  }
  return { baseItemId, seatItemId };
}

/** Persists Stripe subscription line item ids + renewal anchor from a Stripe subscription object. */
export async function persistOrganizationSubscriptionStripeItems(
  organizationId: mongoose.Types.ObjectId,
  sub: Stripe.Subscription,
  plan: Pick<SubscriptionPlanDoc, 'stripeBasePriceId' | 'stripeSeatPriceId'> | null
) {
  if (!plan) return;
  const { baseItemId, seatItemId } = extractBaseAndSeatItemIds(sub, plan);
  const patch: Record<string, unknown> = {};
  if (baseItemId) patch.stripeBaseItemId = baseItemId;
  if (seatItemId) patch.stripeSeatItemId = seatItemId;
  const periodEnd = sub.current_period_end;
  if (typeof periodEnd === 'number') patch.renewsAt = new Date(periodEnd * 1000);
  if (Object.keys(patch).length === 0) return;
  await OrganizationSubscriptionModel.updateOne({ organizationId }, { $set: patch });
}
