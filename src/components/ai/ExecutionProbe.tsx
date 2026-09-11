'use client';
import { useEffect, useRef, useState } from 'react';
import { probeFailureMessages, type ProbeFailureCategory } from '@/lib/ai/probeDiagnostics';
type Result = { outcome: string; httpStatus?: number; toolResultReported?: boolean; cloudflareReported?: boolean; authenticationChallengePresent?: boolean;
  failureCategory?: ProbeFailureCategory; failurePhase?: string; elapsedMs?: number; timeoutMs?: number; startedAt?: string; completedAt?: string };
export default function ExecutionProbe({ kind }: { kind?: 'chat' | 'responses' | 'chat-recheck' | 'chat-detailed' }) {
  const url = kind ? `/api/admin/ai/connection-probe?kind=${kind}` : '/api/admin/ai/execution-probe';
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    void fetch(url, { cache: 'no-store', signal: abort.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Unable to read probe.');
      if (!abort.signal.aborted) setResult(body);
    }).catch(() => { if (!abort.signal.aborted) setError('Unable to read probe status. Reload to retry.'); });
    return () => abort.abort();
  }, [url]);
  async function run() {
    if (lock.current || !window.confirm(kind ? `Send one plain-text ${kind} request to llm.rogly.net, capped at 16 output tokens? No tools or repository data. May incur a provider charge outside project budgets. No automatic retry.` : 'Send the one-time authenticated Python calculation probe to llm.rogly.net? It uses at most 128 output tokens. Diagnostic inference may incur a provider charge and is not charged to a project budget. No repository data is sent.')) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true, ...(kind ? { kind } : {}) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Probe failed.'); setResult(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Result unknown. Reload; do not retry automatically.'); }
    finally { setBusy(false); }
  }
  const alreadyAttempted = Boolean(result && result.outcome !== 'not_started');
  const runDisabled = busy || alreadyAttempted || !result;
  const disabledReason = !result && !error
    ? 'Loading prior result…'
    : alreadyAttempted
      ? 'This one-time probe already ran. Its saved result is kept; Nucleas does not retry the same probe kind automatically. Use a different probe kind only when you intentionally need a new diagnostic.'
      : busy
        ? 'Probe in progress…'
        : null;
  return <section className="space-y-2 rounded border border-border p-3">
    <h2 className="font-semibold">{kind ? `One-time ${kind} connection check` : 'One-time remote execution probe'}</h2>
    {kind === 'chat-recheck' && <p>Fresh authenticated chat check after the network change. Earlier results are preserved; this check can run only once.</p>}
    <p>{kind ? 'Requests “Reply with OK only.” No tools; 16 output tokens maximum. HTTP success means the route accepted the request, not that model output was validated.' : 'Requests only print(17 * 19) from Qwen through the remote Responses API.'} Uses the existing server secret, no repository data, no local execution. This explicit diagnostic can run while planning is paused; it does not enable processing. Counts toward shared request limits and holds shared dispatch for 15 minutes. No automatic retries.</p>
    <p>Even a reported tool result is not sandbox verification or authorization for general execution.</p>
    {result && <p role="status">Outcome: {result.outcome}{result.httpStatus ? ` · HTTP ${result.httpStatus}` : ''}</p>}
    {result?.failureCategory && <p>{probeFailureMessages[result.failureCategory] ?? probeFailureMessages.unknown}</p>}
    {result?.failurePhase && <p>Failure phase: {result.failurePhase === 'awaiting_response' ? 'Waiting for HTTP response headers (DNS, connection, TLS, or remote processing)' : result.failurePhase === 'reading_response' ? 'Reading the HTTP response body' : 'Parsing the HTTP response'}.</p>}
    {result?.elapsedMs !== undefined && <p>Elapsed: {(result.elapsedMs / 1000).toFixed(1)} seconds · Request limit: {(result.timeoutMs ?? 45000) / 1000} seconds.</p>}
    {result?.startedAt && <p>Attempt started (UTC): {result.startedAt}{result.completedAt ? ` · Completed: ${result.completedAt}` : ''}</p>}
    {result && ['transport_failure', 'transport_or_parse_failure'].includes(result.outcome) && !result.failureCategory && <p>This historical result predates detailed error reporting. Its specific cause cannot be recovered from the saved record.</p>}
    {result?.httpStatus && kind && <p>Server header reports Cloudflare: {result.cloudflareReported ? 'yes' : 'no'}. Authentication challenge header present: {result.authenticationChallengePresent ? 'yes' : 'no'}. These clues do not identify which layer rejected a request. Raw headers and response text are discarded.</p>}
    {error && <p role="alert">{error}</p>}
    {disabledReason && <p className="text-sm text-text-secondary">{disabledReason}</p>}
    <button className="rounded border border-border p-2" disabled={runDisabled} onClick={() => void run()} title={disabledReason ?? undefined}>{busy ? 'Probing…' : kind ? `Run one-time ${kind} check` : 'Run one-time calculation probe'}</button>
  </section>;
}
