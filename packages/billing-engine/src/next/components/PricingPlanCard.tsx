import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import type { PublicPricingPlan } from '../../billing/getPublicPricingPlans';
import {
  includedUsersSummary,
  isRecommendedPlan,
  planFeatureBullets,
  primaryPriceLine,
  subscriptionCap,
  trialLine,
} from '../../billing/pricingPlanDisplay';
import { SubscriptionAvailabilityCallout } from './SubscriptionAvailabilityCallout';
import { cn } from '../../ui/cn';

type PricingPlanCardProps = {
  plan: PublicPricingPlan;
  variant?: 'current' | 'selectable' | 'marketing';
  compact?: boolean;
  footer?: ReactNode;
  className?: string;
};

export function PricingPlanCard({
  plan,
  variant = 'marketing',
  compact = false,
  footer,
  className,
}: PricingPlanCardProps) {
  const description = plan.description.trim();
  const features = planFeatureBullets(plan);
  const hasCap = subscriptionCap(plan) !== null;
  const trial = trialLine(plan);
  const recommended = isRecommendedPlan(plan);
  const isCurrent = variant === 'current';
  const isMarketing = variant === 'marketing';

  return (
    <Card
      className={cn(
        'relative flex w-full flex-col overflow-hidden',
        isMarketing
          ? 'border-slate-200/80 bg-white text-gray-900 shadow-float ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-ring'
          : 'border-border bg-card shadow-sm',
        recommended && isMarketing ? 'ring-2 ring-primary/40' : '',
        isCurrent ? 'ring-2 ring-primary/30' : '',
        className
      )}
    >
      {recommended && isMarketing ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 tn-grad-bg" />
      ) : null}
      {isCurrent ? (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">
          Your current plan
        </div>
      ) : null}
      <CardHeader className={cn('space-y-3', compact ? 'pt-4 pb-2' : 'pt-6')}>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className={cn(compact ? 'text-lg' : 'text-xl', isMarketing && 'text-gray-900')}>{plan.name}</CardTitle>
          {plan.badge.trim() ? (
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
              {plan.badge.trim()}
            </span>
          ) : null}
          {plan.soldOut ? (
            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
              Sold out
            </span>
          ) : null}
        </div>
        {description && !compact ? (
          <p className={cn('text-sm leading-relaxed', isMarketing ? 'text-gray-600' : 'text-muted-foreground')}>{description}</p>
        ) : null}
        {hasCap && !compact ? <SubscriptionAvailabilityCallout plan={plan} marketing={isMarketing} /> : null}
      </CardHeader>
      <CardContent className={cn('flex flex-1 flex-col gap-5', compact && 'gap-3')}>
        <div>
          <p className={cn('font-semibold tracking-tight', compact ? 'text-2xl' : 'text-4xl', isMarketing && 'text-gray-900')}>
            {primaryPriceLine(plan)}
          </p>
          {trial ? (
            <p className={cn('mt-2 text-sm font-medium text-primary', isMarketing && 'text-primary')}>
              {trial}
            </p>
          ) : null}
          <p className={cn('mt-2 text-base font-medium', isMarketing ? 'text-gray-900' : 'text-foreground')}>{includedUsersSummary(plan)}</p>
          <p className={cn('mt-0.5 text-sm', isMarketing ? 'text-gray-600' : 'text-muted-foreground')}>Per subscription</p>
        </div>
        {!compact ? (
          <ul className="space-y-2.5">
            {features.map((line: string) => (
              <li key={line} className={cn('flex items-start gap-2.5 text-sm', isMarketing ? 'text-gray-600' : 'text-muted-foreground')}>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
      {footer ? <CardFooter className="mt-auto">{footer}</CardFooter> : null}
    </Card>
  );
}
