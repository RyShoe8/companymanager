'use client';

import { useState } from 'react';
import { PricingPlanCard } from 'billing-engine/next/components';
import type { PublicPricingPlan } from 'billing-engine';
import Button from '@/components/ui/Button';

type Props = {
  plan: PublicPricingPlan;
  disabled: boolean;
  pending: boolean;
  onSelect: (planId: string, billingInterval: 'month' | 'year') => void;
};

export function BillingPlanSelectCard({ plan, disabled, pending, onSelect }: Props) {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  return (
    <PricingPlanCard
      plan={plan}
      variant="selectable"
      compact
      onBillingIntervalChange={setBillingInterval}
      footer={
        <Button
          type="button"
          className="w-full"
          disabled={disabled}
          onClick={() => onSelect(plan.id, billingInterval)}
        >
          {pending ? 'Processing…' : `Select ${plan.name}`}
        </Button>
      }
    />
  );
}
