'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dollarsToMicros, microsToDollars } from '@/lib/ai/settingsSchema';

type Snapshot = { settings: { revision: number; value: { limitMicros: number | null } };
  ceilingMicros: number; effectiveLimitMicros: number; reservationMicros: number; scope: string };
export default function AiBudgetSettingsPanel({ projectId }: { projectId?: string }) {
  const endpoint = `/api/ai/budgets${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`;
  const [data, setData] = useState<Snapshot | null>(null);
  const [amount, setAmount] = useState('');
  const [inherit, setInherit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  function accept(body: Snapshot) {
    setData(body); setInherit(body.settings.value.limitMicros === null);
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
        body: JSON.stringify({ revision: data.settings.revision, value: { limitMicros: inherit ? null : dollarsToMicros(amount) } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save budget.');
      accept(body); setMessage('Saved. Existing usage and reservations remain counted.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-2xl space-y-5 p-6 text-text-primary">
    <h1 className="text-2xl font-semibold">{projectId ? 'Project' : 'Organization'} AI budget</h1>
    {projectId ? <nav className="flex gap-4"><Link className="underline" href={`/workspace/projects/${encodeURIComponent(projectId)}/ai`}>Project planning</Link><Link className="underline" href="/workspace/ai-settings">Organization budget</Link></nav> : <Link href="/workspace" className="underline">Back to workspace</Link>}
    <p>Managers can lower budgets within the shared platform ceilings. The shared model, connection and secrets are controlled by platform admins.</p>
    {message && <p role="status">{message}</p>}
    {data ? <form onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <p>Parent ceiling: ${microsToDollars(data.ceilingMicros)} / month. Effective limit: ${microsToDollars(data.effectiveLimitMicros)} / month.</p>
      <p>Reservation per request: ${microsToDollars(data.reservationMicros)}.</p>
      <label className="flex gap-2"><input type="checkbox" checked={inherit} onChange={event => setInherit(event.target.checked)} />Inherit the parent ceiling</label>
      <label className="block">Monthly limit (USD)<input className="block w-full rounded border border-border bg-background p-2" inputMode="decimal" disabled={inherit} required={!inherit} value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <p className="text-sm text-text-secondary">Zero blocks new requests. Budgets use UTC calendar months. Lowering a limit does not erase spent or reserved amounts. Unknown costs retain reservations; these limits do not guarantee a provider invoice amount.</p>
      <button className="rounded border border-border px-4 py-2" type="submit">{busy ? 'Saving…' : 'Save budget'}</button>
    </fieldset></form> : <p>{message ? 'Reload to retry.' : 'Loading budget…'}</p>}
  </main>;
}
