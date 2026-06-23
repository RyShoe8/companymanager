'use client';

import Link from 'next/link';
import type { PublicPricingPlan } from 'billing-engine/client';
import { PricingPlanCard } from 'billing-engine/next/components';
import Button from '@/components/ui/Button';

type Props = {
  plan: PublicPricingPlan;
  href: string;
  className?: string;
  billingInterval?: 'month' | 'year';
  hideIntervalToggle?: boolean;
};

function withInterval(href: string, billingInterval: 'month' | 'year'): string {
  if (billingInterval !== 'year') return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}interval=year`;
}

export function PricingPlanMarketingCard({
  plan,
  href,
  className,
  billingInterval = 'month',
  hideIntervalToggle = false,
}: Props) {
  return (
    <PricingPlanCard
      plan={plan}
      variant="marketing"
      className={className}
      billingInterval={billingInterval}
      hideIntervalToggle={hideIntervalToggle}
      footer={({ billingInterval: interval }) => (
        <div className="flex w-full flex-col gap-2">
          <Link href={withInterval(href, interval)} className="block w-full">
            <Button className="w-full">Start Free Trial — {plan.name}</Button>
          </Link>
          <Link href="/book-call" className="block w-full">
            <Button variant="secondary" className="w-full">
              Book a call
            </Button>
          </Link>
        </div>
      )}
    />
  );
}
