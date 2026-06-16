import type { PublicPricingPlan } from '../types/publicPricing';
import { getBillingContext } from '../context';
import { DEFAULT_PLAN_FEATURE_BULLETS } from './defaultPlanFeatureBullets';

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function intervalSuffix(interval: PublicPricingPlan['interval']): string {
  switch (interval) {
    case 'month':
      return '/mo';
    case 'year':
      return '/yr';
    case 'lifetime':
      return '';
    default:
      return '';
  }
}

export function trialLine(plan: PublicPricingPlan): string | null {
  if (plan.interval === 'lifetime') return null;
  const days = Math.floor(Number(plan.trialDays ?? 0));
  if (days <= 0) return null;
  return `${days}-day free trial`;
}

export function primaryPriceLine(
  plan: PublicPricingPlan,
  billingInterval: 'month' | 'year' = 'month'
): string {
  if (plan.interval === 'lifetime') {
    return `${formatUsd(plan.basePriceCents)} one-time`;
  }
  if (billingInterval === 'year' && plan.yearlyOffer?.enabled) {
    return `${formatUsd(plan.yearlyOffer.basePriceCents)}/yr`;
  }
  return `${formatUsd(plan.basePriceCents)}${intervalSuffix(plan.interval)}`;
}

export function planHasYearlyToggle(plan: PublicPricingPlan): boolean {
  return plan.interval === 'month' && Boolean(plan.yearlyOffer?.enabled);
}

export function seatPolicyLine(
  plan: PublicPricingPlan,
  billingInterval: 'month' | 'year' = 'month'
): string | null {
  if (plan.interval === 'lifetime') return null;
  const perSeat =
    billingInterval === 'year' && plan.yearlyOffer?.enabled
      ? plan.yearlyOffer.additionalUserPriceCents
      : plan.additionalUserPriceCents;
  const suffix =
    billingInterval === 'year' && plan.yearlyOffer?.enabled ? '/yr' : intervalSuffix(plan.interval);
  if (perSeat > 0) {
    return `Add more users anytime for ${formatUsd(perSeat)} per user${suffix}`;
  }
  return 'No additional seats available on this plan';
}

export function includedUsersSummary(plan: PublicPricingPlan): string {
  const n = Math.max(1, plan.includedUsers);
  return `${n} user${n === 1 ? '' : 's'} included`;
}

export function subscriptionCap(
  plan: PublicPricingPlan
): { max: number; remaining: number } | null {
  const max = plan.maxSubscriptionSlots;
  if (max <= 0) return null;
  return { max, remaining: Math.max(0, max - plan.subscriptionCount) };
}

function baseFeatureBullets(): readonly string[] {
  try {
    const custom = getBillingContext().billing.planFeatureBullets;
    if (custom?.length) return custom;
  } catch {
    /* context not set — use defaults */
  }
  return DEFAULT_PLAN_FEATURE_BULLETS;
}

export function planFeatureBullets(_plan: PublicPricingPlan): string[] {
  return [...baseFeatureBullets()];
}

export function isRecommendedPlan(plan: PublicPricingPlan): boolean {
  return plan.badge.trim().toLowerCase() === 'popular';
}

/** Cheapest (left) to most expensive (right) on the public pricing grid. */
export function sortPlansForPricingDisplay(plans: PublicPricingPlan[]): PublicPricingPlan[] {
  return [...plans].sort((a, b) => a.basePriceCents - b.basePriceCents);
}
