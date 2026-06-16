'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { PublicPricingPlan } from 'billing-engine/client';
import { planHasYearlyToggle } from 'billing-engine/client';
import { BillingIntervalToggleShell } from 'billing-engine/next/components';
import { PricingPlanMarketingCard } from '@/components/pricing/PricingPlanMarketingCard';
import { EnterprisePricingCard } from '@/components/pricing/EnterprisePricingCard';

type BillingInterval = 'month' | 'year';

type Props = {
  plans: PublicPricingPlan[];
  ctaByPlanId: Record<string, string>;
  isRecommendedPlan: (plan: PublicPricingPlan) => boolean;
};

export function PricingPlansSection({ plans, ctaByPlanId, isRecommendedPlan }: Props) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const showGlobalToggle = useMemo(() => plans.some(planHasYearlyToggle), [plans]);

  if (plans.length === 0) {
    return (
      <p className="text-center text-text-secondary max-w-md mx-auto">
        No public plans are available right now. Please check back later or{' '}
        <Link href="/contact" className="text-primary hover:text-primary-hover">
          contact us
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {showGlobalToggle ? (
        <div className="mb-8 flex justify-center">
          <BillingIntervalToggleShell
            value={billingInterval}
            onChange={setBillingInterval}
            marketing
          />
        </div>
      ) : null}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {plans.map((plan) => (
          <PricingPlanMarketingCard
            key={plan.id}
            plan={plan}
            href={ctaByPlanId[plan.id] ?? `/register?plan=${encodeURIComponent(plan.id)}`}
            billingInterval={billingInterval}
            hideIntervalToggle={showGlobalToggle}
            className={isRecommendedPlan(plan) ? 'ring-2 ring-primary/40' : undefined}
          />
        ))}
        <EnterprisePricingCard />
      </div>
    </div>
  );
}
