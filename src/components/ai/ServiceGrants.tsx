'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Grant = { grantId: string; runId: string; operation: string; revision: number; revoked: boolean; expiresAt: string; credentialVersion: number };
type Page = { items: Grant[]; nextCursor: string | null };
const endpoint = '/api/admin/ai/service-identities/grants';
const field = 'rounded border border-border bg-background p-2';

export default function ServiceGrants({ identityId }: { identityId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [runId, setRunId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);

  const load = useCallback(async (before?: string) => {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    try {
      const query = new URLSearchParams({ identityId, ...(before ? { before } : {}) });
      const response = await fetch(`${endpoint}?${query}`, { cache: 'no-store', signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load grants.');
      if (!request.signal.aborted) setPage(body);
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Load failed.'); }
  }, [identityId]);
  // Mounted with an identity key; no background polling or retained pages.
  useEffect(() => { void load(); return () => controller.current?.abort(); }, [load]);

  async function mutate(body: unknown, method: 'POST' | 'DELETE') {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save grant.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed.'); }
    finally { lock.current = false; setBusy(false); }
  }

  return <section className="space-y-3 border-t border-border pt-3">
    <h3 className="font-semibold">Run-scoped grants</h3>
    <p className="text-sm">Grants last five minutes and authorize only this identity’s operation on an eligible run. Rotation, disablement, policy changes, and revocation can invalidate them earlier. Issuing a grant does not start execution.</p>
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void mutate({ identityId, runId, expiresInSeconds: 300 }, 'POST'); }}>
      <input className={field} aria-label="Run ID for grant" value={runId} pattern="[a-fA-F0-9]{24}" required disabled={busy} onChange={event => setRunId(event.target.value)} />
      <button className={field} disabled={busy}>Issue five-minute grant</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <button className={field} disabled={busy} onClick={() => void load()}>Refresh grants</button>
    {page?.items.map(grant => <div key={grant.grantId} className="space-y-1 break-all text-sm">
      <p>{grant.operation} · run {grant.runId} · credential v{grant.credentialVersion}</p>
      <p>Grant {grant.grantId} · {grant.revoked ? 'revoked' : `expires ${grant.expiresAt}`}</p>
      <button className={field} disabled={busy || grant.revoked} onClick={() => void mutate({ grantId: grant.grantId, revision: grant.revision }, 'DELETE')}>Revoke grant</button>
    </div>)}
    {page?.items.length === 0 && <p>No grants on this page.</p>}
    {page?.nextCursor && <button className={field} disabled={busy} onClick={() => void load(page.nextCursor!)}>Older grants</button>}
  </section>;
}
