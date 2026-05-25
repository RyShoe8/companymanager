import type { PublicPricingPlan } from '../../billing/getPublicPricingPlans';
import { subscriptionCap } from '../../billing/pricingPlanDisplay';

export function SubscriptionAvailabilityCallout({ plan }: { plan: PublicPricingPlan }) {
  const cap = subscriptionCap(plan);
  if (!cap) return null;

  if (plan.soldOut) {
    return (
      <div className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Sold out</p>
        <p className="mt-1 text-lg font-semibold text-destructive">All {cap.max} subscriptions claimed</p>
        <p className="text-sm text-muted-foreground">Check back later or choose another plan</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary/25 bg-primary/5 px-4 py-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Limited availability</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{cap.remaining}</p>
      <p className="text-sm text-muted-foreground">
        of {cap.max} subscription{cap.max === 1 ? '' : 's'} still available. Claim yours before
        they&apos;re gone
      </p>
    </div>
  );
}
