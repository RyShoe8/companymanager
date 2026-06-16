'use client';

import Link from 'next/link';
import type { PublicPricingPlan } from 'billing-engine/client';
import { PricingPlanCard } from 'billing-engine/next/components';
import Button from '@/components/ui/Button';

type Props = {
  plan: PublicPricingPlan;
  href: string;
  className?: string;
};

function withInterval(href: string, billingInterval: 'month' | 'year'): string {
  if (billingInterval !== 'year') return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}interval=year`;
}

export function PricingPlanMarketingCard({ plan, href, className }: Props) {
  return (
    <PricingPlanCard
      plan={plan}
      variant="marketing"
      className={className}
      footer={({ billingInterval }) => (
        <Link href={withInterval(href, billingInterval)} className="block w-full">
          <Button className="w-full">Start Free Trial — {plan.name}</Button>
        </Link>
      )}
    />
  );
}
