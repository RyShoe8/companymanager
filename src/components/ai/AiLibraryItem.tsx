'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LibraryDetail } from '@/lib/ai/libraryView';
import { useAiSnapshot } from './useAiSnapshot';

export default function AiLibraryItem({ projectId, kind, itemId }: { projectId: string; kind: string; itemId: string }) {
  const root = `/workspace/projects/${encodeURIComponent(projectId)}/ai`;
  const api = `/api/projects/${encodeURIComponent(projectId)}/ai`;
  const { data, loading, error, refresh } = useAiSnapshot<LibraryDetail>(`${api}/library/${encodeURIComponent(kind)}/${encodeURIComponent(itemId)}`);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  async function approve() {
    if (mutation.current || data?.kind !== 'plans') return;
    const controller = new AbortController(); mutation.current = controller;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(api, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_plan', planId: data.plan.id, digest: data.plan.digest }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Approval failed.');
      if (!controller.signal.aborted) {
        setMessage(body.alreadyApproved ? 'This exact plan was already approved; no duplicate tasks were created.' : 'Plan approved and tasks created. No code was executed.');
        refresh();
      }
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Approval failed.'); }
    finally { mutation.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-5 p-6 text-text-primary">
    <nav className="flex gap-4"><Link className="underline" href={`${root}/library`}>Objective and plan history</Link><Link className="underline" href={root}>Project planning</Link></nav>
    <h1 className="text-2xl font-semibold">{kind === 'objectives' ? 'Objective details' : 'Review plan version'}</h1>
    <button className="underline disabled:opacity-50" disabled={loading || busy} onClick={refresh}>Refresh</button>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}{loading && <p role="status">Loading details…</p>}
    {data?.kind === 'objectives' && <>
      <h2 className="text-xl font-medium">{data.objective.title}</h2>
      <p className="whitespace-pre-wrap">{data.objective.outcome}</p>
      {data.objective.constraints && <section><h3 className="font-medium">Constraints</h3><p className="whitespace-pre-wrap">{data.objective.constraints}</p></section>}
      <section><h3 className="font-medium">Acceptance criteria</h3><ul className="list-disc pl-5">{data.objective.acceptanceCriteria.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
      {data.planningEnabled ? <Link className="underline" href={`${root}?objectiveId=${encodeURIComponent(data.objective.id)}`}>Use this objective for a new plan</Link> : <p>Planning is disabled. This objective remains available for reference.</p>}
    </>}
    {data?.kind === 'plans' && <>
      <h2 className="whitespace-pre-wrap text-xl font-medium">{data.plan.summary}</h2>
      <p>{data.plan.source} · {data.plan.status} · Approval expiry: {new Date(data.plan.expiresAt).toLocaleString()}</p>
      <nav className="flex gap-4"><Link className="underline" href={`${root}/library/objectives/${encodeURIComponent(data.plan.objectiveId)}`}>Source objective</Link>
        {data.plan.runId && <Link className="underline" href={`${root}/runs/${encodeURIComponent(data.plan.runId)}`}>Source AI run</Link>}</nav>
      <ol className="list-decimal space-y-4 pl-5">{data.plan.tasks.map(task => <li key={task.key}>
        <h3 className="font-medium">{task.name}</h3>{task.description && <p className="whitespace-pre-wrap">{task.description}</p>}
        <ul className="list-disc pl-5">{task.acceptanceCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>
        {task.dependsOn.length > 0 && <p className="text-sm">Depends on: {task.dependsOn.join(', ')}</p>}
      </li>)}</ol>
      <p className="break-all text-xs text-text-secondary">Version digest: {data.plan.digest}</p>
      {data.plan.status === 'approved' ? <p>Approved {data.plan.approvedAt ? new Date(data.plan.approvedAt).toLocaleString() : '(time unavailable)'}. {data.plan.materializedTaskIds.length} tasks were created; this does not mean they were executed.</p> : <>
        {!data.planningEnabled && <p>Planning is disabled. Approval is unavailable.</p>}
        {data.plan.expired && <p>This draft expired. Create and review a fresh draft from the source objective.</p>}
        {data.plan.stale && <p>The project changed after this draft was prepared. Create and review a fresh draft before approval.</p>}
        {!data.canManage && <p>A project manager or administrator must approve this version.</p>}
        <p>Approval appends unassigned active tasks and preserves existing assignments. It does not start code execution. The server rechecks this exact version, expiry and project state.</p>
        {data.canManage && data.planningEnabled && !data.plan.expired && !data.plan.stale &&
          <button className="rounded border border-border px-3 py-2 disabled:opacity-50" disabled={busy} onClick={() => void approve()}>{busy ? 'Approving…' : `Approve this version and create ${data.plan.tasks.length} tasks`}</button>}
      </>}
    </>}
  </main>;
}
