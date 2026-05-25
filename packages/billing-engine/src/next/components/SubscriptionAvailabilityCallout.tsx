import type { PublicPricingPlan } from '../../billing/getPublicPricingPlans';
import { subscriptionCap } from '../../billing/pricingPlanDisplay';

export function SubscriptionAvailabilityCallout({
  plan,
  marketing = false,
}: {
  plan: PublicPricingPlan;
  marketing?: boolean;
}) {
  const cap = subscriptionCap(plan);
  if (!cap) return null;

  const mutedClass = marketing ? 'text-gray-600' : 'text-muted-foreground';
  const strongClass = marketing ? 'text-gray-900' : 'text-foreground';
  const soldOutClass = marketing ? 'text-red-600' : 'text-destructive';

  if (plan.soldOut) {
    return (
      <div className={`rounded-xl border-2 px-4 py-3 text-center ${marketing ? 'border-red-300 bg-red-50' : 'border-destructive/30 bg-destructive/10'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${soldOutClass}`}>Sold out</p>
        <p className={`mt-1 text-lg font-semibold ${soldOutClass}`}>All {cap.max} subscriptions claimed</p>
        <p className={`text-sm ${mutedClass}`}>Check back later or choose another plan</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary/25 bg-primary/5 px-4 py-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Limited availability</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${strongClass}`}>{cap.remaining}</p>
      <p className={`text-sm ${mutedClass}`}>
        of {cap.max} subscription{cap.max === 1 ? '' : 's'} still available. Claim yours before
        they&apos;re gone
      </p>
    </div>
  );
}
