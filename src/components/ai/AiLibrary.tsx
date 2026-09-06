'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LibraryKind, LibraryPage } from '@/lib/ai/libraryView';
import { useAiSnapshot } from './useAiSnapshot';

export default function AiLibrary({ projectId }: { projectId: string }) {
  const [kind, setKind] = useState<LibraryKind>('objectives');
  const [cursor, setCursor] = useState<string | null>(null);
  const root = `/workspace/projects/${encodeURIComponent(projectId)}/ai`;
  const { data, error, loading, refresh } = useAiSnapshot<LibraryPage>(`/api/projects/${encodeURIComponent(projectId)}/ai/library?kind=${kind}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  function select(next: LibraryKind) { setKind(next); setCursor(null); }
  return <main className="mx-auto max-w-4xl space-y-5 p-6 text-text-primary">
    <Link href={root} className="underline">Project planning</Link>
    <h1 className="text-2xl font-semibold">Objectives and plan history</h1>
    <p className="text-sm text-text-secondary">25 summaries per page. Open an item to load its full details. Nothing is polled in the background.</p>
    <nav aria-label="History type" className="flex gap-4">
      <button aria-pressed={kind === 'objectives'} className="underline" onClick={() => select('objectives')}>Objectives</button>
      <button aria-pressed={kind === 'plans'} className="underline" onClick={() => select('plans')}>Plans</button>
    </nav>
    <div className="flex gap-4"><button disabled={loading} className="underline disabled:opacity-50" onClick={() => cursor ? setCursor(null) : refresh()}>Newest items</button>
      <button disabled={loading} className="underline disabled:opacity-50" onClick={refresh}>Refresh this page</button></div>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">Loading history…</p>}
    {data && <>
      <ul className="space-y-3">{data.items.map(item => <li key={item.id} className="space-y-2 rounded border border-border p-4">
        <Link className="underline" href={`${root}/library/${data.kind}/${encodeURIComponent(item.id)}`}>{item.title}</Link>
        <p className="text-sm text-text-secondary">{new Date(item.createdAt).toLocaleString()}{item.status && ` · ${item.status}`}{item.source && ` · ${item.source}`}</p>
        {item.expiresAt && <p className="text-sm">Approval expiry: {new Date(item.expiresAt).toLocaleString()}</p>}
      </li>)}</ul>
      {!data.items.length && <p>No {data.kind} on this page.</p>}
      {data.nextCursor && <button className="rounded border border-border px-3 py-2" onClick={() => setCursor(data.nextCursor)}>Older items</button>}
    </>}
  </main>;
}
