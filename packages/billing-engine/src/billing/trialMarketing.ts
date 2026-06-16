import type { PublicPricingPlan } from './getPublicPricingPlans';

export function maxTrialDaysFromPlans(
  plans: Pick<PublicPricingPlan, 'trialDays' | 'interval'>[]
): number {
  return plans.reduce((max, plan) => {
    if (plan.interval === 'lifetime') return max;
    const days = Math.floor(Number(plan.trialDays ?? 0));
    return days > max ? days : max;
  }, 0);
}

export function formatTrialDaysLabel(days: number): string {
  const n = Math.floor(days);
  if (n <= 0) return '';
  return `${n}-day`;
}

export function trialHeroBadge(maxTrialDays: number): string | null {
  const label = formatTrialDaysLabel(maxTrialDays);
  if (!label) return null;
  return `${label} Free Trial on All Plans`;
}

export function trialCtaButtonLabel(maxTrialDays: number): string {
  const label = formatTrialDaysLabel(maxTrialDays);
  if (!label) return 'Get Started';
  return `Start Your ${label} Free Trial`;
}

export function trialFeatureCtaSubtext(maxTrialDays: number): string {
  const label = formatTrialDaysLabel(maxTrialDays);
  if (!label) return 'Full platform access.';
  return `Full platform access. ${label} free trial.`;
}

export function trialPricingFaqAnswer(maxTrialDays: number): string {
  const label = formatTrialDaysLabel(maxTrialDays);
  if (!label) {
    return 'Plans are available without a trial period. You get full access to the entire platform on the plan you choose.';
  }
  return `Yes. Eligible plans include a ${label} free trial with full platform access so you can see how Nucleas fits your workflow before your first charge.`;
}

export function trialAfterEndFaqAnswer(maxTrialDays: number): string {
  const label = formatTrialDaysLabel(maxTrialDays);
  if (!label) {
    return 'Your subscription continues on the plan you selected. All your data and settings are preserved.';
  }
  return `After your ${label} trial, billing starts on the plan you chose. All your data and settings are preserved.`;
}

export function trialWontBeChargedUntil(trialEndsAt: Date | string): string {
  const d = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  if (Number.isNaN(d.getTime())) return "You won't be charged until your trial ends.";
  return `You won't be charged until ${d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}.`;
}
