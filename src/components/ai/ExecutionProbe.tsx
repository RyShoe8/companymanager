'use client';
import { useEffect, useRef, useState } from 'react';
type Result = { outcome: string; httpStatus?: number; toolResultReported?: boolean };
export default function ExecutionProbe() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/admin/ai/execution-probe', { cache: 'no-store', signal: abort.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Unable to read probe.');
      if (!abort.signal.aborted) setResult(body);
    }).catch(() => { if (!abort.signal.aborted) setError('Unable to read probe status. Reload to retry.'); });
    return () => abort.abort();
  }, []);
  async function run() {
    if (lock.current || !window.confirm('Send the one-time authenticated Python calculation probe to llm.rogly.net? It uses at most 128 output tokens. Diagnostic inference may incur a provider charge and is not charged to a project budget. No repository data is sent.')) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/ai/execution-probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Probe failed.'); setResult(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Result unknown. Reload; do not retry automatically.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-2 rounded border border-border p-3">
    <h2 className="font-semibold">One-time remote execution probe</h2>
    <p>Requests only print(17 * 19) from Qwen through the remote Responses API. Uses the existing server secret, no repository data, no local execution. This explicit diagnostic can run while planning is paused; it does not enable processing. Counts toward shared request limits and holds shared dispatch for 15 minutes. No automatic retries.</p>
    <p>Even a reported tool result is not sandbox verification or authorization for general execution.</p>
    {result && <p role="status">Outcome: {result.outcome}{result.httpStatus ? ` · HTTP ${result.httpStatus}` : ''}</p>}
    {error && <p role="alert">{error}</p>}
    <button className="rounded border border-border p-2" disabled={busy || result?.outcome !== 'not_started'} onClick={() => void run()}>{busy ? 'Probing…' : 'Run one-time calculation probe'}</button>
  </section>;
}
