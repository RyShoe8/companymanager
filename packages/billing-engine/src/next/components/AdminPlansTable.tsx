'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '../../ui/button';
import { formatUsd } from '../../billing/pricingPlanDisplay';

export type PlanRow = {
  _id: string;
  name: string;
  slug: string;
  interval: string;
  basePriceCents: number;
  additionalUserPriceCents: number;
  includedUsers: number;
  active: boolean;
  paused: boolean;
  archived?: boolean;
  version: number;
  stripeBasePriceId?: string;
  maxSubscriptionSlots?: number;
  subscriptionCount?: number;
  soldOut?: boolean;
  trialDays?: number;
};

function fmtMoney(cents: number) {
  return formatUsd(cents);
}

function slotsLabel(p: PlanRow) {
  const max = p.maxSubscriptionSlots ?? 0;
  const used = p.subscriptionCount ?? 0;
  if (max === 0) return `${used} / ∞`;
  return `${used} / ${max}${p.soldOut ? ' (sold out)' : ''}`;
}

export function AdminPlansTable({
  initialPlans,
  mode,
}: {
  initialPlans: PlanRow[];
  mode: 'active' | 'archived';
}) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgIsError, setMsgIsError] = useState(false);

  const reportSuccess = (text: string) => {
    setMsg(text);
    setMsgIsError(false);
  };

  const reportError = (text: string, alertUser = false) => {
    setMsg(text);
    setMsgIsError(true);
    if (alertUser) window.alert(text);
  };

  const listUrl = mode === 'archived' ? '/api/admin/plans?archived=true' : '/api/admin/plans?archived=false';

  const reload = useCallback(async () => {
    const res = await fetch(listUrl, { credentials: 'include' });
    const j = await res.json();
    if (res.ok) setPlans(j.plans);
  }, [listUrl]);

  async function sync(id: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/plans/${id}/sync`, { method: 'POST', credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      reportError(typeof j.error === 'string' ? j.error : 'Sync failed');
      return;
    }
    reportSuccess('Synced to Stripe.');
    await reload();
    router.refresh();
  }

  async function clone(id: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/plans/${id}/clone`, { method: 'POST', credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      reportError(typeof j.error === 'string' ? j.error : 'Clone failed');
      return;
    }
    reportSuccess('Plan cloned. Edit the new version and sync.');
    await reload();
    router.refresh();
  }

  async function togglePause(id: string, paused: boolean) {
    setMsg(null);
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !paused }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      reportError(typeof j.error === 'string' ? j.error : 'Update failed');
      return;
    }
    await reload();
    router.refresh();
  }

  async function setArchived(id: string, archived: boolean) {
    setMsg(null);
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      reportError(typeof j.error === 'string' ? j.error : 'Update failed');
      return;
    }
    reportSuccess(archived ? 'Plan archived.' : 'Plan restored to active catalog.');
    await reload();
    router.refresh();
  }

  async function removePlan(id: string, name: string) {
    if (
      !window.confirm(
        `Permanently delete "${name}"? This cannot be undone. Plans with active subscribers cannot be deleted.`
      )
    ) {
      return;
    }
    setMsg(null);
    const res = await fetch(`/api/admin/plans/${id}`, { method: 'DELETE', credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      reportError(typeof j.error === 'string' ? j.error : 'Delete failed', true);
      return;
    }
    reportSuccess('Plan deleted.');
    await reload();
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <p className={`text-sm ${msgIsError ? 'text-red-400' : 'text-text-secondary'}`}>{msg}</p>
      ) : null}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="overflow-x-auto rounded-md border min-w-0">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b bg-background-elevated text-left">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Interval</th>
              <th className="p-3 font-medium">Trial</th>
              <th className="p-3 font-medium">Base</th>
              <th className="p-3 font-medium">Slots</th>
              <th className="p-3 font-medium">Active</th>
              <th className="p-3 font-medium">Paused</th>
              <th className="p-3 font-medium">Ver</th>
              <th className="p-3 font-medium">Stripe</th>
              <th className="p-3 font-medium w-64">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-text-muted">
                  {mode === 'archived' ? 'No archived plans.' : 'No active plans.'}
                </td>
              </tr>
            ) : (
              plans.map((p) => (
                <tr key={p._id} className="border-b last:border-0">
                  <td className="p-3 font-medium">
                    {p.name}
                    <span className="block text-xs text-text-muted">v{p.version}</span>
                  </td>
                  <td className="p-3">{p.interval}</td>
                  <td className="p-3">
                    {(p.trialDays ?? 0) > 0 ? `${p.trialDays}d` : '—'}
                  </td>
                  <td className="p-3">{fmtMoney(p.basePriceCents)}</td>
                  <td className="p-3">{slotsLabel(p)}</td>
                  <td className="p-3">{p.active ? 'Yes' : 'No'}</td>
                  <td className="p-3">{p.paused ? 'Yes' : 'No'}</td>
                  <td className="p-3">{p.version}</td>
                  <td className="p-3">{p.stripeBasePriceId ? 'Yes' : 'No'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {mode === 'active' ? (
                        <>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void sync(p._id)}>
                            Sync
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void clone(p._id)}>
                            Clone
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void togglePause(p._id, p.paused)}
                          >
                            {p.paused ? 'Unpause' : 'Pause'}
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void setArchived(p._id, true)}>
                            Archive
                          </Button>
                          <Link
                            href={`/admin/plans/${p._id}/edit`}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg bg-secondary-light text-secondary hover:bg-secondary-light/80 border border-secondary/20 transition-colors"
                          >
                            Edit
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => void removePlan(p._id, p.name)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void setArchived(p._id, false)}>
                            Unarchive
                          </Button>
                          <Link
                            href={`/admin/plans/${p._id}/edit`}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg bg-secondary-light text-secondary hover:bg-secondary-light/80 border border-secondary/20 transition-colors"
                          >
                            Edit
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => void removePlan(p._id, p.name)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
