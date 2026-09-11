'use client';

import { useEffect, useState } from 'react';
import { dollarsToMicros, microsToDollars, type PlatformAiSettings } from '@/lib/ai/settingsSchema';
import { AiDispatchUsage } from '@/components/ai/AiDispatchUsage';
import { AiDiagnostics } from '@/components/ai/AiDiagnostics';
import Link from 'next/link';
import ExecutionProbe from '@/components/ai/ExecutionProbe';

const field = 'block w-full rounded border border-border bg-background p-2 text-text-primary';
const budgetFields = [['reservationMicros', 'Reservation per request'], ['organizationLimitMicros', 'Monthly ceiling per organization'],
  ['projectLimitMicros', 'Monthly ceiling per project']] as const;
type Snapshot = { settings: { revision: number; value: PlatformAiSettings }; secrets: { bearerTokenConfigured: boolean; cronSecretConfigured: boolean } };

export default function AiSettingsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [values, setValues] = useState<PlatformAiSettings | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmEndpoint, setConfirmEndpoint] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/ai', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load settings.');
      if (!controller.signal.aborted) {
        setSnapshot(body); setValues(body.settings.value);
        setAmounts(Object.fromEntries(budgetFields.map(([key]) => [key, microsToDollars(body.settings.value[key])])));
      }
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshot || !values || busy) return;
    setBusy(true); setMessage('');
    try {
      const value = { ...values, ...Object.fromEntries(budgetFields.map(([key]) => [key, dollarsToMicros(amounts[key])])) };
      const response = await fetch('/api/admin/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: snapshot.settings.revision, value, confirmEndpoint }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save settings.');
      setSnapshot({ ...snapshot, settings: body.settings }); setValues(body.settings.value); setConfirmEndpoint(false);
      setMessage('Saved. Settings apply to subsequent checks without a redeploy. Changed policy invalidates previously queued drafts in progress.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-5 p-6 text-text-primary">
    <h1 className="text-2xl font-semibold">AI Settings</h1>
    <p>Platform-wide connection and safeguards. All organizations can use planning. Models run remotely; code execution remains disabled.</p>
    <AiDispatchUsage />
    <AiDiagnostics />
    <ExecutionProbe />
    <ExecutionProbe kind="chat" />
    <ExecutionProbe kind="responses" />
    <ExecutionProbe kind="chat-recheck" />
    <ExecutionProbe kind="chat-detailed" />
    <ExecutionProbe kind="chat-recovery" />
    <Link className="inline-block underline" href="/admin/ai/service-identities">Manage scoped service identities</Link>
    {message && <p role="status" className="rounded border border-border p-3">{message}</p>}
    {!values || !snapshot ? <p>{message ? 'Reload this page to retry.' : 'Loading settings…'}</p> : <form onSubmit={save}>
      <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
        <section className="space-y-3"><h2 className="text-lg font-semibold">Processing controls</h2>
          {([['planningEnabled', 'Enable planning for all organizations'], ['remoteEnabled', 'Enable remote inference connection'],
            ['dispatchEnabled', 'Process queued AI requests']] as const).map(([key, label]) =>
            <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={values[key]} onChange={event => setValues({ ...values, [key]: event.target.checked })} />{label}</label>)}
          <p className="text-sm text-text-secondary">Pause processing to stop new calls. An already-dispatched remote request may continue; changed policy prevents publishing its draft. Disable processing before disabling planning or the connection.</p>
        </section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Shared inference connection</h2>
          <label className="block">API format<select className={field} value={values.protocol} disabled><option value="openai-chat">OpenAI-compatible chat</option></select></label>
          <label className="block">Endpoint URL<input className={field} type="url" required maxLength={2048} value={values.endpoint} onChange={event => { setValues({ ...values, endpoint: event.target.value }); setConfirmEndpoint(false); }} /></label>
          <label className="block">Model<input className={field} required maxLength={200} value={values.model} onChange={event => setValues({ ...values, model: event.target.value })} /></label>
          {values.endpoint !== snapshot.settings.value.endpoint && <label className="flex gap-2"><input type="checkbox" required checked={confirmEndpoint} onChange={event => setConfirmEndpoint(event.target.checked)} />I authorize this endpoint to receive the server bearer token and selected objective data.</label>}
          <p>Bearer token: {snapshot.secrets.bearerTokenConfigured ? 'configured' : 'missing'} · Cron secret: {snapshot.secrets.cronSecretConfigured ? 'configured' : 'missing'}</p>
          <p className="text-sm text-text-secondary">Secrets stay in Vercel and are never shown here. Setting a model does not test its availability.</p>
        </section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Shared server load limits</h2>
          {([['dailyRequestLimit', 'Maximum attempts per UTC day', 1, 10000],
            ['minimumIntervalSeconds', 'Minimum seconds between attempts', 1, 86400],
            ['maxOutputTokens', 'Maximum output tokens per request', 256, 4096]] as const).map(([key, label, min, max]) =>
            <label className="block" key={key}>{label}<input className={field} type="number" required min={min} max={max} step={1}
              value={values[key]} onChange={event => setValues({ ...values, [key]: Number(event.target.value) })} /></label>)}
          <p className="text-sm text-text-secondary">Shared across all organizations. Limited requests stay queued and can be cancelled. Failed or interrupted attempts count; editing settings does not reset usage. These bounds do not guarantee the remote server’s capacity. Confirm limits with its owner before increasing them.</p>
        </section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Budget ceilings (USD)</h2>
          {budgetFields.map(([key, label]) => <label className="block" key={key}>{label}<input className={field} inputMode="decimal" required value={amounts[key]} onChange={event => setAmounts({ ...amounts, [key]: event.target.value })} /></label>)}
          <p className="text-sm text-text-secondary">Zero blocks new requests. The project ceiling cannot exceed the organization ceiling. Processing requires a positive reservation within both ceilings. Organization managers may set lower limits. Limits use UTC calendar months; existing usage and reservations are never reset by editing settings.</p>
          <label className="flex gap-2"><input type="checkbox" checked={values.noProviderFee} onChange={event => setValues({ ...values, noProviderFee: event.target.checked })} />The endpoint owner confirms there is no provider inference fee.</label>
          <p className="text-sm text-text-secondary">A reservation is not a measured charge or provider invoice guarantee. Unknown charges retain reservations. Even with no provider fee, a positive reservation bounds concurrent admission and is released on completion.</p>
        </section>
        <button className="rounded border border-border px-4 py-2" type="submit">{busy ? 'Saving…' : 'Save AI settings'}</button>
      </fieldset>
    </form>}
  </main>;
}
