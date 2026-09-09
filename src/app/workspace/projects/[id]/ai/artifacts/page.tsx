'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
type Item = { artifactId: string; runId: string; taskId: string; artifactDigest: string; executionVerified: boolean; createdAt: string };

export default function ArtifactsPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<{ items: Item[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (before?: string) => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request; setError('');
    try {
      const response = await fetch(`/api/projects/${id}/ai/artifacts${before ? `?before=${encodeURIComponent(before)}` : ''}`, { cache: 'no-store', signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load artifacts.');
      if (!request.signal.aborted) setPage(body);
    } catch (failure) { if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load artifacts.'); }
  }, [id]);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  return <main className="mx-auto max-w-3xl space-y-4 p-6 text-text-primary">
    <Link href={`/workspace/projects/${id}/ai`}>← Project AI</Link>
    <h1 className="text-2xl font-semibold">Artifacts and reviews</h1>
    <p>Recorded coding results, not deployed changes. Unverified execution evidence cannot complete tasks. No coding worker is currently enabled.</p>
    <button className="underline" onClick={() => void load()}>Refresh newest</button>
    {error && <p role="alert">{error}</p>}
    {!page ? <p>Loading artifacts…</p> : !page.items.length ? <p>No artifacts in this page.</p> : <ul className="space-y-3">
      {page.items.map(item => <li key={item.artifactId} className="rounded border border-border p-3">
        <Link className="underline" href={`/workspace/projects/${id}/ai/artifacts/${item.artifactId}`}>Inspect artifact {item.artifactDigest.slice(0, 12)}</Link>
        <p>{item.executionVerified ? 'Execution evidence verified' : 'Execution evidence unverified'} · {item.createdAt.slice(0, 10)}</p>
        <Link className="underline" href={`/workspace/projects/${id}/ai/runs/${item.runId}`}>Source run</Link>
      </li>)}
    </ul>}
    {page?.nextCursor && <button className="underline" onClick={() => void load(page.nextCursor!)}>Older artifacts</button>}
  </main>;
}
