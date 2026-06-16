'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FocusEvent } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { cn } from '../../ui/cn';
import {
  formatCentsAsDollarInput,
  parseDollarInputToCents,
} from '../../billing/moneyInput';

type Interval = 'month' | 'year' | 'lifetime';

type YearlyOfferForm = {
  enabled: boolean;
  basePriceCents: number;
  additionalUserPriceCents: number;
};

const emptyYearlyOffer = (): YearlyOfferForm => ({
  enabled: false,
  basePriceCents: 0,
  additionalUserPriceCents: 0,
});

const empty = {
  name: '',
  interval: 'year' as Interval,
  basePriceCents: 1000,
  additionalUserPriceCents: 0,
  includedUsers: 1,
  description: '',
  badge: '',
  maxSubscriptionSlots: 0,
  trialDays: 0,
  yearlyOffer: emptyYearlyOffer(),
  onboardingCallsEnabled: false,
};

function intervalHelperText(interval: Interval): string {
  switch (interval) {
    case 'month':
      return 'Set monthly prices below. Enable yearly pricing to show a month/year toggle on the public pricing page.';
    case 'year':
      return 'This plan bills yearly only. Choose Month above to offer both monthly and yearly on one plan.';
    case 'lifetime':
      return 'One-time purchase only. Choose Month to offer recurring monthly and optional yearly billing.';
  }
}

function basePriceLabel(interval: Interval): string {
  if (interval === 'month') return 'Monthly base price';
  if (interval === 'year') return 'Yearly base price';
  return 'One-time base price';
}

function seatPriceLabel(interval: Interval): string {
  if (interval === 'month') return 'Monthly seat price';
  if (interval === 'year') return 'Yearly seat price';
  return 'Additional user price';
}

function DollarPriceInput({
  id,
  label,
  cents,
  onChangeCents,
  required = false,
}: {
  id: string;
  label: string;
  cents: number;
  onChangeCents: (cents: number) => void;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(() => formatCentsAsDollarInput(cents));

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDisplay(raw);
    onChangeCents(parseDollarInputToCents(raw));
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    const nextCents = parseDollarInputToCents(e.target.value);
    onChangeCents(nextCents);
    setDisplay(formatCentsAsDollarInput(nextCents));
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-muted">
          $
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          className="pl-7"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          required={required}
        />
      </div>
    </div>
  );
}

export function AdminPlanForm({
  mode,
  planId,
  initial,
  stripeProductId,
}: {
  mode: 'create' | 'edit';
  planId?: string;
  initial?: typeof empty;
  stripeProductId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        interval: form.interval,
        basePriceCents: Number(form.basePriceCents),
        additionalUserPriceCents: Number(form.additionalUserPriceCents),
        includedUsers: Number(form.includedUsers),
        description: form.description,
        badge: form.badge,
        maxSubscriptionSlots: Number(form.maxSubscriptionSlots),
        trialDays: Number(form.trialDays),
        onboardingCallsEnabled: form.onboardingCallsEnabled,
      };
      if (form.interval === 'month') {
        body.yearlyOffer = {
          enabled: form.yearlyOffer.enabled,
          basePriceCents: Number(form.yearlyOffer.basePriceCents),
          additionalUserPriceCents: Number(form.yearlyOffer.additionalUserPriceCents),
        };
      }
      const url = mode === 'create' ? '/api/admin/plans' : `/api/admin/plans/${planId}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === 'string' ? j.error : typeof j.error === 'object' ? JSON.stringify(j.error) : 'Save failed');
        return;
      }
      router.push('/admin/plans');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create plan' : 'Edit plan'}</CardTitle>
        <CardDescription>Enter amounts in US dollars (for example, 39.00).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interval">Interval</Label>
            <select
              id="interval"
              className={cn(
                'flex h-9 w-full rounded-md border border-border px-3 py-1 text-sm shadow-sm',
                'bg-background-elevated text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50',
                '[&>option]:bg-background-card [&>option]:text-text-primary'
              )}
              value={form.interval}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setForm((f) => ({ ...f, interval: e.target.value as Interval }))
              }
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <p className="text-xs text-text-muted">{intervalHelperText(form.interval)}</p>
          </div>
          {form.interval === 'month' ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <input
                  type="checkbox"
                  checked={form.yearlyOffer.enabled}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      yearlyOffer: { ...f.yearlyOffer, enabled: e.target.checked },
                    }))
                  }
                />
                Also offer yearly pricing
              </label>
              {form.yearlyOffer.enabled ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Yearly pricing</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DollarPriceInput
                      id="yearBase"
                      label="Yearly base price"
                      cents={form.yearlyOffer.basePriceCents}
                      onChangeCents={(basePriceCents) =>
                        setForm((f) => ({
                          ...f,
                          yearlyOffer: { ...f.yearlyOffer, basePriceCents },
                        }))
                      }
                    />
                    <DollarPriceInput
                      id="yearSeat"
                      label="Yearly seat price"
                      cents={form.yearlyOffer.additionalUserPriceCents}
                      onChangeCents={(additionalUserPriceCents) =>
                        setForm((f) => ({
                          ...f,
                          yearlyOffer: { ...f.yearlyOffer, additionalUserPriceCents },
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="trialDays">Trial days</Label>
            <Input
              id="trialDays"
              type="number"
              min={0}
              max={365}
              value={form.trialDays}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, trialDays: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-text-muted">
              0 = no trial. Applies on first Stripe Checkout only; lifetime plans ignore trial.
            </p>
            {mode === 'edit' && !stripeProductId ? (
              <p className="text-xs text-amber-600">
                Sync this plan to Stripe after saving so checkout can use it.
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              'space-y-3',
              form.interval === 'month' && form.yearlyOffer.enabled
                ? 'rounded-md border border-border p-3'
                : ''
            )}
          >
            {form.interval === 'month' && form.yearlyOffer.enabled ? (
              <p className="text-xs font-medium text-text-secondary">Monthly pricing</p>
            ) : null}
            <DollarPriceInput
              id="base"
              label={basePriceLabel(form.interval)}
              cents={form.basePriceCents}
              onChangeCents={(basePriceCents) => setForm((f) => ({ ...f, basePriceCents }))}
              required
            />
            <DollarPriceInput
              id="seat"
              label={seatPriceLabel(form.interval)}
              cents={form.additionalUserPriceCents}
              onChangeCents={(additionalUserPriceCents) =>
                setForm((f) => ({ ...f, additionalUserPriceCents }))
              }
            />
            <p className="text-xs text-text-muted">
              Set seat price to $0.00 to disallow employees beyond included users (no seat add-ons).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.onboardingCallsEnabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, onboardingCallsEnabled: e.target.checked }))
              }
            />
            Include onboarding call
          </label>
          <div className="space-y-2">
            <Label htmlFor="inc">Included users</Label>
            <Input
              id="inc"
              type="number"
              min={1}
              value={form.includedUsers}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, includedUsers: Number(e.target.value) }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxSlots">Max subscriptions (0 = unlimited)</Label>
            <Input
              id="maxSlots"
              type="number"
              min={0}
              value={form.maxSubscriptionSlots}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, maxSubscriptionSlots: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-text-muted">
              Promo cap: every org signup uses a slot permanently (cancel does not free a slot).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="badge">Badge (optional)</Label>
            <Input
              id="badge"
              value={form.badge}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, badge: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/admin/plans')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
