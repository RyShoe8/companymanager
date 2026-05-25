import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import type { PublicPricingPlan } from '../billing/getPublicPricingPlans';
import { getPlanSubscriptionCapUsage } from '../billing/planSubscriptionCap';

export async function mapPlanDocToPublicPricing(
  plan: SubscriptionPlanDoc
): Promise<PublicPricingPlan> {
  const usage = await getPlanSubscriptionCapUsage(plan);
  return {
    id: String(plan._id),
    slug: String(plan.slug ?? ''),
    name: String(plan.name ?? ''),
    description: String(plan.description ?? ''),
    badge: String(plan.badge ?? ''),
    interval: plan.interval,
    basePriceCents: Number(plan.basePriceCents ?? 0),
    additionalUserPriceCents: Number(plan.additionalUserPriceCents ?? 0),
    includedUsers: Math.max(1, Number(plan.includedUsers ?? 1)),
    version: Number(plan.version ?? 1),
    maxSubscriptionSlots: Number(plan.maxSubscriptionSlots ?? 0),
    subscriptionCount: usage.used,
    soldOut: usage.soldOut,
  };
}
