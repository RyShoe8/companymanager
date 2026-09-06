'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { runFailureGuidance, type AiEventPage, type AiRunDetail } from '@/lib/ai/runView';
import { microsToDollars } from '@/lib/ai/settingsSchema';
import { useAiSnapshot } from './useAiSnapshot';

const when = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded';
const money = (value: number | null) => value === null ? 'Unknown' : `$${microsToDollars(value)}`;
function RunEvents({ endpoint }: { endpoint: string }) {
  const [after, setAfter] = useState<number | null>(null);
  const { data, error, loading, refresh } = useAiSnapshot<AiEventPage>(`${endpoint}?view=events${after === null ? '' : `&after=${after}`}`);
  return <section className="space-y-3">
    <h2 className="text-lg font-semibold">Recorded events</h2>
    <p className="text-sm text-text-secondary">Application events, not model reasoning. Up to 50 events per page; pages replace rather than accumulate.</p>
    <div className="flex gap-4"><button disabled={loading} className="underline disabled:opacity-50" onClick={() => after === null ? refresh() : setAfter(null)}>First events</button>
      <button disabled={loading} className="underline disabled:opacity-50" onClick={refresh}>Refresh events</button></div>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">Loading events…</p>}
    {data && <><ol className="space-y-3 border-l border-border pl-4">{data.events.map(event => <li key={event.sequence}>
      <p className="font-medium">#{event.sequence} · {event.type}</p><p className="text-sm text-text-secondary">{when(event.createdAt)}</p><p>{event.summary}</p>
    </li>)}</ol>{!data.events.length && <p>No recorded events on this page.</p>}
      {data.nextAfter !== null && <button className="rounded border border-border px-3 py-2" onClick={() => setAfter(data.nextAfter)}>Next events</button>}
    </>}
  </section>;
}

export default function AiRunInspector({ projectId, runId }: { projectId: string; runId: string }) {
  const root = `/workspace/projects/${encodeURIComponent(projectId)}/ai`;
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/ai/runs/${encodeURIComponent(runId)}`;
  const { data, error, loading, refresh } = useAiSnapshot<AiRunDetail & { canManage: boolean }>(endpoint);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  async function cancel() {
    if (mutation.current) return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ action: 'cancel' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to cancel.');
      if (!controller.signal.aborted) { setMessage('Cancellation recorded. Refresh events for the audit entry. Remote inference may still have run.'); refresh(); }
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Cancellation failed.'); }
    finally { mutation.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-6 text-text-primary">
    <nav className="flex gap-4"><Link href={`${root}/runs`} className="underline">Run history</Link><Link href={root} className="underline">Project planning</Link></nav>
    <h1 className="text-2xl font-semibold">AI run details</h1>
    <p className="break-all text-sm">Run ID: {runId}</p>
    <button disabled={loading || busy} className="underline disabled:opacity-50" onClick={refresh}>Refresh run</button>
    <p className="text-sm text-text-secondary">No background polling. Recorded snapshots may change while the worker runs. “Completed” here means the planning run was accepted, not that its project tasks were executed.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}{loading && <p role="status">Loading run…</p>}
    {data && <>
      <section className="space-y-2"><h2 className="text-lg font-semibold">{data.run.role} · {data.run.status.replaceAll('_', ' ')}</h2>
        <p>Model: {data.run.model ?? 'Unknown'} · Revision: {data.run.revision}</p>
        <p>Created: {when(data.run.createdAt)} · Started: {when(data.run.startedAt)}</p>
        <p>Recorded completion: {when(data.run.completedAt)}</p>
        {data.run.failureCode && <p role="status" className="rounded border border-border p-3">{data.run.failureCode}: {runFailureGuidance(data.run.failureCode)}</p>}
        {data.job?.cancelRequested && <p>Cancellation requested; acceptance is fenced. This is not proof that the provider stopped computing.</p>}
        {data.canManage && data.job && !data.job.cancelRequested && ['queued', 'running'].includes(data.job.status) &&
          <button className="rounded border border-border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={() => void cancel()}>{busy ? 'Cancelling…' : 'Cancel planning run'}</button>}
      </section>
      <section className="space-y-2"><h2 className="text-lg font-semibold">Usage and reservations</h2>
        <p>Input tokens: {data.run.inputTokens ?? 'Unknown'} · Output tokens: {data.run.outputTokens ?? 'Unknown'}</p>
        <p>Inference latency: {data.run.latencyMs === null ? 'Unknown' : `${data.run.latencyMs} ms`} · Provider cost: {money(data.run.costMicros)}</p>
        <p className="text-sm text-text-secondary">Organization and project reservations cover the same request against two limits; do not add them as separate provider charges. Unknown cost is not zero.</p>
        <ul className="space-y-2">{data.reservations.map((reservation, index) => <li key={index}>
          {reservation.scope} · {reservation.period ?? 'Period unknown'} · {reservation.state} · reserved {money(reservation.amountMicros)} · settled cost {money(reservation.actualMicros)}
        </li>)}</ul>{!data.reservations.length && <p>No reservation records available.</p>}
      </section>
      {data.plan && <section className="space-y-2"><h2 className="text-lg font-semibold">Plan evidence</h2>
        <p className="break-all">Plan ID: {data.plan.id} · {data.plan.status} · {data.plan.taskCount} proposed tasks</p>
        <Link className="underline" href={`${root}/library/plans/${encodeURIComponent(data.plan.id)}`}>Review this plan version</Link>
        <p>Expires: {when(data.plan.expiresAt)} · Approved: {when(data.plan.approvedAt)}</p>
        <p>Materialized tasks: {data.plan.materializedTaskIds.length}. This does not indicate task completion.</p>
        <p className="break-all text-xs">Plan digest: {data.plan.digest}</p>
      </section>}
      <details className="space-y-2 rounded border border-border p-3"><summary>Input versions and dispatch evidence</summary>
        <p className="break-all text-sm">Objective ID: {data.run.objectiveId ?? 'Not recorded'} · Task ID: {data.run.taskId ?? 'Not task-bound'}</p>
        <p className="break-all text-xs">Input digest: {data.run.inputDigest}</p><p className="break-all text-xs">Policy digest: {data.run.policyDigest}</p>
        {data.job && <><p>Project snapshot: {when(data.job.projectUpdatedAt)}</p><p>Dispatch recorded: {when(data.job.dispatchedAt)} · Lease expiry: {when(data.job.leaseExpiresAt)}</p></>}
        <p className="text-sm">Dispatch timestamps do not prove provider completion. Prompts, credentials and lease tokens are not exposed.</p>
      </details>
      <RunEvents endpoint={endpoint} />
    </>}
  </main>;
}
