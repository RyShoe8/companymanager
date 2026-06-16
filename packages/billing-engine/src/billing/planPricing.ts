import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';

export type BillingInterval = 'month' | 'year';

export type ResolvedPlanPrices = {
  basePriceId: string;
  seatPriceId: string;
  additionalUserPriceCents: number;
  basePriceCents: number;
  billingInterval: BillingInterval;
};

export function planHasYearlyOffer(plan: Pick<SubscriptionPlanDoc, 'interval' | 'yearlyOffer'>): boolean {
  return plan.interval === 'month' && Boolean(plan.yearlyOffer?.enabled);
}

export function resolvePlanStripePrices(
  plan: SubscriptionPlanDoc,
  billingInterval: BillingInterval = 'month'
): ResolvedPlanPrices {
  if (plan.interval === 'lifetime') {
    return {
      basePriceId: plan.stripeBasePriceId ?? '',
      seatPriceId: '',
      additionalUserPriceCents: 0,
      basePriceCents: Number(plan.basePriceCents ?? 0),
      billingInterval: 'month',
    };
  }

  if (plan.interval === 'year') {
    return {
      basePriceId: plan.stripeBasePriceId ?? '',
      seatPriceId: plan.stripeSeatPriceId ?? '',
      additionalUserPriceCents: Number(plan.additionalUserPriceCents ?? 0),
      basePriceCents: Number(plan.basePriceCents ?? 0),
      billingInterval: 'year',
    };
  }

  if (billingInterval === 'year' && plan.yearlyOffer?.enabled) {
    return {
      basePriceId: plan.yearlyOffer.stripeBasePriceId ?? '',
      seatPriceId: plan.yearlyOffer.stripeSeatPriceId ?? '',
      additionalUserPriceCents: Number(plan.yearlyOffer.additionalUserPriceCents ?? 0),
      basePriceCents: Number(plan.yearlyOffer.basePriceCents ?? 0),
      billingInterval: 'year',
    };
  }

  return {
    basePriceId: plan.stripeBasePriceId ?? '',
    seatPriceId: plan.stripeSeatPriceId ?? '',
    additionalUserPriceCents: Number(plan.additionalUserPriceCents ?? 0),
    basePriceCents: Number(plan.basePriceCents ?? 0),
    billingInterval: 'month',
  };
}

export function validatePlanPricesSynced(
  plan: SubscriptionPlanDoc,
  billingInterval: BillingInterval = 'month'
): string | null {
  const resolved = resolvePlanStripePrices(plan, billingInterval);
  if (!resolved.basePriceId?.trim()) {
    return billingInterval === 'year' && plan.yearlyOffer?.enabled
      ? 'Yearly prices not synced to Stripe yet'
      : 'Plan not synced to Stripe yet';
  }
  if (resolved.additionalUserPriceCents > 0 && !resolved.seatPriceId?.trim()) {
    return 'Seat prices not synced to Stripe yet';
  }
  return null;
}
