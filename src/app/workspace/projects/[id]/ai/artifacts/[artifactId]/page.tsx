'use client';

import Link from 'next/link';
import ArtifactContent from '@/components/ai/ArtifactContent';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArtifactBinding } from '../../../../../../../../packages/ai-contracts/src/review';

type Detail = { artifactId: string; binding: ArtifactBinding; executionVerified: boolean; canManage: boolean;
  evidenceDigests: string[]; acceptance: { acceptedAt: string; reviewId: string } | null;
  review: { reviewId: string; verdict: string; expiresAt: string; findings: Array<{ severity: string; summary: string; evidenceDigest: string }> } | null };

export default function ArtifactPage() {
  const { id, artifactId } = useParams<{ id: string; artifactId: string }>();
  const [loadedDetail, setDetail] = useState<Detail | null>(null);
  const detail = loadedDetail?.artifactId === artifactId && loadedDetail.binding.projectId === id ? loadedDetail : null;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch(`/api/projects/${id}/ai/artifacts/${artifactId}`, { cache: 'no-store', signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load artifact.');
      if (!request.signal.aborted) setDetail(body);
    } catch (error) { if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Load failed.'); }
  }, [id, artifactId]);
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);
  async function accept() {
    if (!detail?.review || submitting.current || !detail.executionVerified) return;
    if (!window.confirm('Accept this exact reviewed artifact and mark its task complete? This does not publish or deploy code.')) return;
    submitting.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/projects/${id}/ai/reviews/${detail.review.reviewId}/accept`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Acceptance failed.');
      setMessage('Artifact accepted. Nothing was published or deployed.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Acceptance failed. Refresh before retrying.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-4 p-6 text-text-primary">
    <Link href={`/workspace/projects/${id}/ai/artifacts`}>← Artifacts</Link>
    <h1 className="text-2xl font-semibold">Artifact review</h1>
    <button className="underline" disabled={busy} onClick={() => void load()}>Refresh</button>
    {message && <p role="status">{message}</p>}
    {!detail ? <p>Loading artifact…</p> : <>
      <p>{detail.executionVerified ? 'Execution evidence verified.' : 'Execution evidence is unverified. Acceptance is blocked until an authorized sandbox verification integration exists.'}</p>
      <dl className="space-y-2 break-all">{Object.entries(detail.binding).map(([key, value]) => <div key={key}><dt className="font-semibold">{key}</dt><dd>{value}</dd></div>)}</dl>
      <h2 className="text-lg font-semibold">Evidence digests</h2>
      <ul className="break-all">{detail.evidenceDigests.map(digest => <li key={digest}>{digest}</li>)}</ul>
      <ArtifactContent key={`${id}:${artifactId}`} projectId={id} artifactId={artifactId} evidenceDigests={detail.evidenceDigests} />
      <h2 className="text-lg font-semibold">Review</h2>
      {!detail.review ? <p>No recorded review.</p> : <>
        <p>{detail.review.verdict} · expires {detail.review.expiresAt}</p>
        <ul className="space-y-2">{detail.review.findings.map((finding, index) => <li key={index} className="rounded border border-border p-3"><p>{finding.severity}: {finding.summary}</p><p className="break-all text-sm">Evidence: {finding.evidenceDigest}</p></li>)}</ul>
      </>}
      {detail.acceptance ? <p>Accepted {detail.acceptance.acceptedAt}</p> : detail.canManage && <button className="rounded border border-border p-2" disabled={busy || !detail.executionVerified || detail.review?.verdict !== 'passed'} onClick={() => void accept()}>Accept exact reviewed result</button>}
    </>}
  </main>;
}
