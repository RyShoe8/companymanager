'use client';

import { useAiSnapshot } from './useAiSnapshot';
type Count = { count: number; capped: boolean };
type Snapshot = { asOf: string; queued: Count; running: Count; expired: Count;
  oldestQueuedAt: string | null; dispatchLeaseExpiresAt: string | null };
const displayCount = (value: Count) => `${value.count}${value.capped ? '+' : ''}`;

export function AiDiagnostics() {
  const { data, error, loading, refresh } = useAiSnapshot<Snapshot>('/api/admin/ai/diagnostics');
  return <section className="space-y-3 rounded border border-border p-4" aria-label="Planning diagnostics">
    <h2 className="text-lg font-semibold">Planning diagnostics</h2>
    <button type="button" disabled={loading} onClick={refresh} className="rounded border border-border px-3 py-1">Refresh diagnostics</button>
    {loading && <p role="status">Loading diagnostics…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>Queued: {displayCount(data.queued)} · Running records: {displayCount(data.running)} · Expired running leases: {displayCount(data.expired)}</p>
      <p>Oldest queued request: {data.oldestQueuedAt ?? 'None'}.</p>
      <p>Dispatch lease expires: {data.dispatchLeaseExpiresAt ?? 'No unexpired lease recorded'}.</p>
      {data.expired.count > 0 && <p>Expired attempts await recovery by the scheduled worker while processing is enabled. Do not resend automatically: inference may already have run and charges may be unknown.</p>}
      <p className="text-sm text-text-secondary">Snapshot: {data.asOf}. Counts stop at 100+ and may change between reads. Running records and leases do not prove the remote host is active. If requests remain queued, check processing controls, usage limits and Vercel cron logs. This view does not repair jobs, release reservations, contact the provider or poll automatically.</p>
    </>}
  </section>;
}
