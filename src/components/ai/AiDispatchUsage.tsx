'use client';

import type { DispatchUsageView } from '@/lib/ai/dispatchUsageView';
import { useAiSnapshot } from './useAiSnapshot';

export function AiDispatchUsage() {
  const { data, error, loading, refresh } = useAiSnapshot<DispatchUsageView>('/api/admin/ai/usage');
  return <section className="space-y-3 rounded border border-border p-4" aria-label="Shared inference usage">
    <h2 className="text-lg font-semibold">Shared inference usage</h2>
    <button type="button" disabled={loading} onClick={refresh} className="rounded border border-border px-3 py-1">Refresh usage</button>
    {loading && <p role="status">Loading usage…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>{data.attempts} / {data.dailyLimit} attempts on {data.utcDay} (UTC) · {data.remaining} remaining</p>
      <p>Processing controls: {data.processingEnabled ? 'enabled' : 'paused'}. Earliest allowed by request limits: {data.nextEligibleAt}.</p>
      <p>Last recorded attempt: {data.lastAttemptAt ?? 'None recorded'}.</p>
      <p className="text-sm text-text-secondary">Snapshot: {data.asOf}. Refresh after saving limits. This is not a scheduled start time or a server-health check: worker leases, credentials, budgets and queued work can delay processing. Failed or interrupted attempts count. Host CPU, memory and provider charges are not measured here. No automatic polling.</p>
    </>}
  </section>;
}
