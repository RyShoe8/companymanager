'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AttentionFilter, AttentionPage } from '@/lib/ai/attentionView';
import { runFailureGuidance } from '@/lib/ai/runView';
import { useAiSnapshot } from './useAiSnapshot';

export default function AiAttention() {
  const [filter, setFilter] = useState<AttentionFilter>('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mutation = useRef<AbortController | null>(null);
  const { data, error, loading, refresh } = useAiSnapshot<AttentionPage>(`/api/ai/attention?filter=${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  useEffect(() => () => mutation.current?.abort(), []);
  async function acknowledge(item: AttentionPage['items'][number]) {
    if (mutation.current) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/ai/attention', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ projectId: item.projectId, runId: item.id, revision: item.revision }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to acknowledge.');
      if (!controller.signal.aborted) { setMessage('Acknowledged for you only. The run remains in project history and will reappear here if its revision changes.'); refresh(); }
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Unable to acknowledge.'); }
    finally { mutation.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-5 p-6 text-text-primary">
    <Link href="/workspace" className="underline">Back to workspace</Link>
    <h1 className="text-2xl font-semibold">AI · Needs attention</h1>
    <p>Review-ready and blocked runs from projects you can access. This is an on-demand view, not a live notification feed.</p>
    <label className="block">Show<select className="ml-3 rounded border border-border bg-background p-2" value={filter}
      onChange={event => { setFilter(event.target.value as AttentionFilter); setCursor(null); }}>
      <option value="all">All attention states</option><option value="review">Review and approval</option><option value="issues">Blocked and failed</option>
    </select></label>
    <nav className="flex gap-4"><button className="underline disabled:opacity-50" disabled={loading || busy} onClick={() => cursor ? setCursor(null) : refresh()}>Newest runs</button>
      <button className="underline disabled:opacity-50" disabled={loading || busy} onClick={refresh}>Refresh</button></nav>
    <p className="text-sm text-text-secondary">Up to 25 items per page, ordered by run creation. Acknowledgment hides this revision for you only; it does not approve a plan, resolve a failure, cancel work, or change anyone else’s list.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}{loading && <p role="status">Loading attention items…</p>}
    {data && <>
      {!data.items.length && <p>{data.nextCursor ? 'No visible items in this batch. Continue to check older runs.' : 'No more unacknowledged attention items in this view.'}</p>}
      <ul className="space-y-4">{data.items.map(item => {
        const root = `/workspace/projects/${encodeURIComponent(item.projectId)}/ai`;
        return <li key={item.id} className="space-y-3 rounded border border-border p-4">
          <h2 className="font-semibold">{item.projectName} · {item.status.replaceAll('_', ' ')}</h2>
          <p className="text-sm text-text-secondary">{item.role} · Created {new Date(item.createdAt).toLocaleString()}</p>
          {item.failureCode && <p>{runFailureGuidance(item.failureCode)}</p>}
          <div className="flex flex-wrap gap-4"><Link className="underline" href={`${root}/runs/${encodeURIComponent(item.id)}`}>Inspect run</Link>
            {item.planId && <Link className="underline" href={`${root}/library/plans/${encodeURIComponent(item.planId)}`}>{data.canManage ? 'Review plan version' : 'View plan version'}</Link>}
            <button className="underline disabled:opacity-50" disabled={busy} onClick={() => void acknowledge(item)}>Acknowledge for me</button>
          </div>
        </li>;
      })}</ul>
      {data.nextCursor && <button disabled={busy} className="rounded border border-border px-3 py-2 disabled:opacity-50" onClick={() => setCursor(data.nextCursor)}>Continue to older runs</button>}
    </>}
  </main>;
}
