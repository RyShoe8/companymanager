/** Client-safe pricing / seat types (no mongoose). */

export type PlanInterval = 'month' | 'year' | 'lifetime';

export type PublicPricingYearlyOffer = {
  enabled: boolean;
  basePriceCents: number;
  additionalUserPriceCents: number;
};

export type PublicPricingPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  badge: string;
  interval: PlanInterval;
  basePriceCents: number;
  additionalUserPriceCents: number;
  includedUsers: number;
  version: number;
  maxSubscriptionSlots: number;
  subscriptionCount: number;
  soldOut: boolean;
  trialDays: number;
  yearlyOffer: PublicPricingYearlyOffer | null;
  onboardingCallsEnabled: boolean;
};

export type EmployeeLimitInfo = {
  currentCount: number;
  maxEmployees: number | null;
  includedUsers: number | null;
  canAddMore: boolean;
  canAddBeyondIncluded: boolean;
};
