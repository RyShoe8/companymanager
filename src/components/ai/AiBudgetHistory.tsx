'use client';
import { useState } from 'react';
import { useAiSnapshot } from './useAiSnapshot';
import { microsToDollars } from '@/lib/ai/settingsSchema';
type Page = { items: Array<{ period: string; limitMicros: number; spentMicros: number; reservedMicros: number }>; nextCursor: string | null };

export function AiBudgetHistory({ projectId }: { projectId?: string }) {
  const [before, setBefore] = useState<string | null>(null);
  const query = new URLSearchParams();
  if (projectId) query.set('projectId', projectId);
  if (before) query.set('before', before);
  const { data, error, loading, refresh } = useAiSnapshot<Page>(`/api/ai/budgets/history?${query}`);
  return <section className="space-y-3 rounded border border-border p-4" aria-label="Monthly AI budget history">
    <h2 className="text-lg font-semibold">Monthly budget history</h2>
    <p className="text-sm text-text-secondary">Recorded UTC months, newest first. Limits reflect the ledger’s last admission setting for that month, not necessarily today’s ceiling. Held reservations may include unresolved costs; this is not an invoice. Organization and project entries must not be added together.</p>
    <div className="flex gap-3"><button type="button" disabled={loading} onClick={refresh}>Refresh history</button>
      {before && <button type="button" disabled={loading} onClick={() => setBefore(null)}>Newest months</button>}</div>
    {loading && <p role="status">Loading history…</p>}{error && <p role="alert">{error}</p>}
    {data && <>
      {!data.items.length && <p>No recorded budget activity on this page.</p>}
      <ul className="space-y-3">{data.items.map(item => <li key={item.period} className="border-t border-border pt-2">
        <h3 className="font-semibold">{item.period}</h3>
        <p>Settled: ${microsToDollars(item.spentMicros)} · Reserved: ${microsToDollars(item.reservedMicros)} · Recorded limit: ${microsToDollars(item.limitMicros)}</p>
      </li>)}</ul>
      {data.nextCursor && <button type="button" onClick={() => setBefore(data.nextCursor)}>Older months</button>}
    </>}
  </section>;
}
