import type { EmployeeLimitInfo, PublicPricingPlan } from 'billing-engine';
import { formatUsd, intervalSuffix } from 'billing-engine/pricing-display';

export function seatUsageLine(
  limits: EmployeeLimitInfo | null | undefined,
  plan: PublicPricingPlan | null | undefined
): string | null {
  if (!limits) return null;
  const count = limits.currentCount;
  if (limits.maxEmployees !== null) {
    const remaining = Math.max(0, limits.maxEmployees - count);
    return `${count} of ${limits.maxEmployees} seats in use${remaining > 0 ? ` · ${remaining} remaining` : ''}`;
  }
  if (limits.canAddBeyondIncluded && plan && plan.additionalUserPriceCents > 0) {
    return `${count} seats in use · add more at ${formatUsd(plan.additionalUserPriceCents)} per user${intervalSuffix(plan.interval)}`;
  }
  if (limits.includedUsers !== null) {
    const remaining = Math.max(0, limits.includedUsers - count);
    return `${count} of ${limits.includedUsers} included seats${remaining > 0 ? ` · ${remaining} remaining` : ''}`;
  }
  return `${count} seat${count === 1 ? '' : 's'} in use`;
}
