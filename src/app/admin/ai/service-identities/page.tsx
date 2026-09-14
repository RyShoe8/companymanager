'use client';

import { useEffect, useRef, useState } from 'react';
import ServiceGrants from '@/components/ai/ServiceGrants';

type Identity = { identityId: string; name: string; role: string; status: string; revision: number;
  credentialVersion: number; credentialExpiresAt: string | null };
type Page = { items: Identity[]; nextCursor: string | null };
const endpoint = '/api/admin/ai/service-identities';
const field = 'rounded border border-border bg-background p-2';

export default function ServiceIdentitiesPage() {
  const [page, setPage] = useState<Page | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('reviewer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [credential, setCredential] = useState('');
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mutationBusy = useRef(false);

  async function load(before?: string) {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch(`${endpoint}${before ? `?before=${encodeURIComponent(before)}` : ''}`, { cache: 'no-store', signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load identities.');
      if (!request.signal.aborted) setPage(body);
    } catch (error) { if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Load failed.'); }
  }
  useEffect(() => { void load(); return () => { controller.current?.abort(); }; }, []);

  async function mutate(body: unknown, method: 'POST' | 'PATCH') {
    if (mutationBusy.current) return;
    mutationBusy.current = true; setBusy(true); setCredential(''); setMessage('');
    try {
      const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save identity.');
      if (result.credential) setCredential(result.credential);
      setMessage('Saved. Credentials grant no authority without a current scoped grant.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed. Reload before retrying an uncertain rotation.'); }
    finally { mutationBusy.current = false; setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-5 p-6 text-text-primary">
    <h1 className="text-2xl font-semibold">Service identities</h1>
    <p>Administrator controls for your current organization. New identities are disabled. Issue a credential, then explicitly activate. These credentials are separate from the model provider token and do not enable code execution.</p>
    <form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); void mutate({ name, role }, 'POST'); }}>
      <input className={field} aria-label="Identity name" value={name} maxLength={100} required disabled={busy} onChange={event => setName(event.target.value)} />
      <select className={field} aria-label="Identity role" value={role} disabled={busy} onChange={event => setRole(event.target.value)}><option value="reviewer">Reviewer</option><option value="architect">Architect</option></select>
      <button className={field} disabled={busy || !name.trim()}>Register disabled identity</button>
    </form>
    {message && <p role="status">{message}</p>}
    {credential && <section className="space-y-2 rounded border border-border p-3">
      <p>This credential is shown only now and expires in 30 days. Store it in the authorized service’s secret manager—not the model provider settings. Rotation invalidates its previous credential and grants.</p>
      <input type="password" readOnly value={credential} autoComplete="off" aria-label="New service credential" className={`${field} w-full`} onFocus={event => event.target.select()} />
      <button className={field} onClick={() => setCredential('')}>Dismiss credential</button>
    </section>}
    <button className={field} disabled={busy} onClick={() => { setCredential(''); void load(); }}>Refresh newest</button>
    {!page ? <p>Loading identities…</p> : page.items.length === 0 ? <p>No identities in this page.</p> : <ul className="space-y-3">
      {page.items.map(identity => <li key={identity.identityId} className="space-y-2 rounded border border-border p-3">
        <h2 className="font-semibold">{identity.name} — {identity.role}</h2>
        <p>{identity.status} · credential version {identity.credentialVersion} · {identity.credentialExpiresAt ? `expires ${identity.credentialExpiresAt.slice(0, 10)}` : 'no credential issued'}</p>
        <p className="break-all text-sm">{identity.identityId}</p>
        <div className="flex flex-wrap gap-2">{(['rotate', identity.status === 'active' ? 'disable' : 'activate', 'revoke'] as const).map(action =>
          <button className={field} key={action} disabled={busy || identity.status === 'revoked'} onClick={() => {
            if ((action === 'revoke' || action === 'rotate') && !window.confirm(action === 'revoke' ? 'Permanently revoke this identity?' : 'Replace the credential? Its previous credential and grants will stop working.')) return;
            void mutate({ identityId: identity.identityId, revision: identity.revision, action }, 'PATCH');
          }}>{action === 'rotate' ? 'Issue / rotate credential' : action === 'revoke' ? 'Revoke permanently' : action}</button>)}</div>
        <button className={field} onClick={() => setSelectedIdentity(selectedIdentity === identity.identityId ? null : identity.identityId)}>Manage grants</button>
        {selectedIdentity === identity.identityId && <ServiceGrants key={identity.identityId} identityId={identity.identityId} />}
      </li>)}
    </ul>}
    {page?.nextCursor && <button className={field} disabled={busy} onClick={() => { setCredential(''); void load(page.nextCursor!); }}>Older identities</button>}
  </main>;
}
