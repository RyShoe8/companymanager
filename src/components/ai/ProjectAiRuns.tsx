'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AiRunPage } from '@/lib/ai/runView';
import { microsToDollars } from '@/lib/ai/settingsSchema';
import { useAiSnapshot } from './useAiSnapshot';

export default function ProjectAiRuns({ projectId }: { projectId: string }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const root = `/workspace/projects/${encodeURIComponent(projectId)}/ai`;
  const { data, loading, error, refresh } = useAiSnapshot<AiRunPage>(`/api/projects/${encodeURIComponent(projectId)}/ai/runs${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  return <main className="mx-auto max-w-4xl space-y-5 p-6 text-text-primary">
    <Link href={root} className="underline">Project planning</Link>
    <h1 className="text-2xl font-semibold">AI run history</h1>
    <p className="text-sm text-text-secondary">25 runs per page. This view refreshes only when you ask; queued work continues on the server.</p>
    <nav className="flex gap-4">
      <button className="underline disabled:opacity-50" disabled={loading} onClick={() => cursor ? setCursor(null) : refresh()}>Newest runs</button>
      <button className="underline disabled:opacity-50" disabled={loading} onClick={refresh}>Refresh this page</button>
    </nav>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading runs…</p>}
    {data && <>
      {!data.runs.length && <p>No runs on this page.</p>}
      <ul className="space-y-3">{data.runs.map(run => <li key={run.id} className="space-y-2 rounded border border-border p-4">
        <Link className="underline" href={`${root}/runs/${encodeURIComponent(run.id)}`}>{run.role} · {run.status.replaceAll('_', ' ')}</Link>
        <p className="text-sm">{new Date(run.createdAt).toLocaleString()} · {run.model ?? 'Model unknown'}</p>
        <p className="text-sm text-text-secondary">Tokens: {run.inputTokens ?? 'Unknown'} input / {run.outputTokens ?? 'Unknown'} output · Provider cost: {run.costMicros === null ? 'Unknown' : `$${microsToDollars(run.costMicros)}`}</p>
      </li>)}</ul>
      {data.nextCursor && <button className="rounded border border-border px-3 py-2" onClick={() => setCursor(data.nextCursor)}>Older runs</button>}
    </>}
  </main>;
}
