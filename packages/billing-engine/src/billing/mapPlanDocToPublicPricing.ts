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
    trialDays: Number(plan.trialDays ?? 0),
    yearlyOffer:
      plan.interval === 'month' && plan.yearlyOffer?.enabled
        ? {
            enabled: true,
            basePriceCents: Number(plan.yearlyOffer.basePriceCents ?? 0),
            additionalUserPriceCents: Number(plan.yearlyOffer.additionalUserPriceCents ?? 0),
          }
        : null,
    onboardingCallsEnabled: Boolean(plan.onboardingCallsEnabled),
  };
}
