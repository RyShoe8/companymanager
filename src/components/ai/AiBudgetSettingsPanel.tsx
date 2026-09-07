'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dollarsToMicros, microsToDollars } from '@/lib/ai/settingsSchema';

type Snapshot = { settings: { revision: number; value: { limitMicros: number | null; paused: boolean } }; parentPaused: boolean;
  usage: { period: string; asOf: string; ledgerExists: boolean; spentMicros: number; reservedMicros: number; remainingMicros: number };
  ceilingMicros: number; effectiveLimitMicros: number; reservationMicros: number; scope: string };
export default function AiBudgetSettingsPanel({ projectId }: { projectId?: string }) {
  const endpoint = `/api/ai/budgets${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`;
  const [data, setData] = useState<Snapshot | null>(null);
  const [amount, setAmount] = useState('');
  const [inherit, setInherit] = useState(true);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  function accept(body: Snapshot) {
    setData(body); setInherit(body.settings.value.limitMicros === null);
    setPaused(body.settings.value.paused);
    setAmount(microsToDollars(body.settings.value.limitMicros ?? body.ceilingMicros));
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load budget.');
      if (!controller.signal.aborted) accept(body);
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [endpoint]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!data || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: data.settings.revision, value: { limitMicros: inherit ? null : dollarsToMicros(amount), paused } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save budget.');
      accept(body); setMessage('Saved. Existing usage and reservations remain counted.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl space-y-5 p-6 text-text-primary">
    <h1 className="text-2xl font-semibold">{projectId ? 'Project' : 'Organization'} AI budget and controls</h1>
    {projectId ? <nav className="flex gap-4"><Link className="underline" href={`/workspace/projects/${encodeURIComponent(projectId)}/ai`}>Project planning</Link><Link className="underline" href="/workspace/ai-settings">Organization budget</Link></nav> : <Link href="/workspace" className="underline">Back to workspace</Link>}
    <p>Managers can lower budgets within the shared platform ceilings. The shared model, connection and secrets are controlled by platform admins.</p>
    {message && <p role="status">{message}</p>}
    {data ? <form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <label className="flex gap-2"><input type="checkbox" checked={paused} onChange={event => setPaused(event.target.checked)} />Pause remote AI requests for this {projectId ? 'project' : 'organization'}</label>
      {data.parentPaused && <p>Remote processing is also paused by parent controls. Unchecking this scope cannot override them.</p>}
      <p className="text-sm text-text-secondary">Save to apply. Pausing blocks new submissions and subsequent dispatch checks, and rejects results returned after the policy changes. It cannot stop inference already running remotely. Existing queued requests are blocked when checked; resuming requires a new request after review. Manual planning, history and cancellation remain available.</p>
      <p>Parent ceiling: ${microsToDollars(data.ceilingMicros)} / month. Effective limit: ${microsToDollars(data.effectiveLimitMicros)} / month.</p>
      <p>Reservation per request: ${microsToDollars(data.reservationMicros)}.</p>
      <section className="space-y-2 rounded border border-border p-3" aria-label="Current AI budget usage">
        <h2 className="font-semibold">Recorded usage · {data.usage.period} (UTC)</h2>
        <p>Settled spend: ${microsToDollars(data.usage.spentMicros)} · Held reservations: ${microsToDollars(data.usage.reservedMicros)}</p>
        <p>Remaining in this scope: ${microsToDollars(data.usage.remainingMicros)}</p>
        {!data.usage.ledgerExists && <p>No budget activity is recorded for this scope this month.</p>}
        <p className="text-sm text-text-secondary">Snapshot: {data.usage.asOf}. Reload this page for current usage. Saved limits are shown; unsaved edits do not affect this snapshot. Unknown costs remain reserved, not recorded as zero-cost calls. Organization and project ledgers track the same requests against separate ceilings—do not add them together. Parent budgets, pauses and shared request limits may still block admission. This is not a provider invoice.</p>
      </section>
      <label className="flex gap-2"><input type="checkbox" checked={inherit} onChange={event => setInherit(event.target.checked)} />Inherit the parent ceiling</label>
      <label className="block">Monthly limit (USD)<input className="block w-full rounded border border-border bg-background p-2" inputMode="decimal" disabled={inherit} required={!inherit} value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <p className="text-sm text-text-secondary">Zero blocks new requests. Budgets use UTC calendar months. Lowering a limit does not erase spent or reserved amounts. Unknown costs retain reservations; these limits do not guarantee a provider invoice amount.</p>
      <button className="rounded border border-border px-4 py-2" type="submit">{busy ? 'Saving…' : 'Save budget'}</button>
    </fieldset></form> : <p>{message ? 'Reload to retry.' : 'Loading budget…'}</p>}
  </main>;
}
