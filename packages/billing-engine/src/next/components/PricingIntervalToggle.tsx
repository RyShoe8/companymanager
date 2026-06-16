'use client';

import { useState } from 'react';
import type { PublicPricingPlan } from '../../types/publicPricing';
import {
  planHasYearlyToggle,
  primaryPriceLine,
  trialLine,
} from '../../billing/pricingPlanDisplay';
import { cn } from '../../ui/cn';

type BillingInterval = 'month' | 'year';

type PricingIntervalToggleProps = {
  plan: PublicPricingPlan;
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
  marketing?: boolean;
};

export function PricingIntervalToggle({
  plan,
  value,
  onChange,
  className,
  marketing = false,
}: PricingIntervalToggleProps) {
  if (!planHasYearlyToggle(plan)) return null;

  return (
    <div
      className={cn(
        'inline-flex rounded-lg border p-0.5 text-xs font-medium',
        marketing ? 'border-slate-200 bg-slate-50' : 'border-border bg-muted/40',
        className
      )}
      role="group"
      aria-label="Billing interval"
    >
      {(['month', 'year'] as const).map((interval) => (
        <button
          key={interval}
          type="button"
          onClick={() => onChange(interval)}
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            value === interval
              ? marketing
                ? 'bg-white text-gray-900 shadow-sm'
                : 'bg-background-card text-text-primary shadow-sm'
              : marketing
                ? 'text-gray-600 hover:text-gray-900'
                : 'text-text-muted hover:text-text-primary'
          )}
        >
          {interval === 'month' ? 'Monthly' : 'Yearly'}
        </button>
      ))}
    </div>
  );
}

export function usePricingInterval(plan: PublicPricingPlan): {
  billingInterval: BillingInterval;
  setBillingInterval: (interval: BillingInterval) => void;
  priceLine: string;
  trial: string | null;
} {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  return {
    billingInterval,
    setBillingInterval,
    priceLine: primaryPriceLine(plan, billingInterval),
    trial: trialLine(plan),
  };
}
