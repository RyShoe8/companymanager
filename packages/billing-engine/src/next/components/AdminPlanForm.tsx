'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

type Interval = 'month' | 'year' | 'lifetime';

const empty = {
  name: '',
  interval: 'year' as Interval,
  basePriceCents: 1000,
  additionalUserPriceCents: 0,
  includedUsers: 1,
  description: '',
  badge: '',
  maxSubscriptionSlots: 0,
};

export function AdminPlanForm({
  mode,
  planId,
  initial,
}: {
  mode: 'create' | 'edit';
  planId?: string;
  initial?: typeof empty;
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
      const body = {
        name: form.name,
        interval: form.interval,
        basePriceCents: Number(form.basePriceCents),
        additionalUserPriceCents: Number(form.additionalUserPriceCents),
        includedUsers: Number(form.includedUsers),
        description: form.description,
        badge: form.badge,
        maxSubscriptionSlots: Number(form.maxSubscriptionSlots),
      };
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
        <CardDescription>Amounts are in USD cents (e.g. 3900 = $39.00).</CardDescription>
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
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.interval}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setForm((f) => ({ ...f, interval: e.target.value as Interval }))
              }
            >
              <option value="month">month</option>
              <option value="year">year</option>
              <option value="lifetime">lifetime</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="base">Base price (cents)</Label>
            <Input
              id="base"
              type="number"
              min={0}
              value={form.basePriceCents}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, basePriceCents: Number(e.target.value) }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seat">Additional user price (cents)</Label>
            <Input
              id="seat"
              type="number"
              min={0}
              value={form.additionalUserPriceCents}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, additionalUserPriceCents: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disallow employees beyond included users (no seat add-ons).
            </p>
          </div>
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
            <p className="text-xs text-muted-foreground">
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/admin/plans')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
