'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { dollarsToMicros, microsToDollars, type PlatformAiSettings } from '@/lib/ai/settingsSchema';
import { AiDispatchUsage } from '@/components/ai/AiDispatchUsage';
import { AiDiagnostics } from '@/components/ai/AiDiagnostics';
import ExecutionProbe from '@/components/ai/ExecutionProbe';

const field = 'mt-1 block w-full rounded border border-border bg-background p-2 text-text-primary';
const budgetFields = [['reservationMicros', 'Reservation per request'], ['organizationLimitMicros', 'Monthly ceiling per organization'],
  ['projectLimitMicros', 'Monthly ceiling per project']] as const;
const freePoolFields = [['freePoolLimitMicros', 'Free pool limit'], ['freePoolRemainingMicros', 'Free pool remaining']] as const;
type Snapshot = { settings: { revision: number; value: PlatformAiSettings }; secrets: { bearerTokenConfigured: boolean; cronSecretConfigured: boolean; executionWorkerUrlConfigured: boolean; executionWorkerTokenConfigured: boolean } };
type AvailableModel = { id: string; label: string; bestAt: string };

function ModelSelect({ label, description, value, models, onChange }: {
  label: string; description: string; value: string; models: AvailableModel[]; onChange: (value: string) => void;
}) {
  const options = models.some(model => model.id === value) ? models : [{ id: value, label: value, bestAt: '' }, ...models];
  return <label className="block rounded border border-border p-3">
    <span className="font-medium">{label}</span>
    <span className="mt-1 block text-sm text-text-secondary">{description}</span>
    <select className={field} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(model => <option key={model.id} value={model.id}>{model.label} — {model.id}</option>)}
    </select>
  </label>;
}

export default function AiSettingsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [values, setValues] = useState<PlatformAiSettings | null>(null);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [modelError, setModelError] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmEndpoint, setConfirmEndpoint] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch('/api/admin/ai', { signal: controller.signal, cache: 'no-store' }).then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load settings.');
        if (!controller.signal.aborted) {
          setSnapshot(body); setValues(body.settings.value);
          setAmounts(Object.fromEntries([...budgetFields, ...freePoolFields].map(([key]) => [key, microsToDollars(body.settings.value[key] ?? 0)])));
        }
      }),
      fetch('/api/admin/ai/available-models', { signal: controller.signal, cache: 'no-store' }).then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to list models.');
        if (!controller.signal.aborted) setModels(body.models ?? []);
      }).catch(error => { if (!controller.signal.aborted) setModelError(error instanceof Error ? error.message : 'Unable to list models.'); }),
    ]).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Unable to load settings.'); });
    return () => controller.abort();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshot || !values || busy) return;
    setBusy(true); setMessage('');
    try {
      const value = { ...values, ...Object.fromEntries([...budgetFields, ...freePoolFields]
        .map(([key]) => [key, dollarsToMicros(amounts[key] ?? '0')])) };
      const response = await fetch('/api/admin/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: snapshot.settings.revision, value, confirmEndpoint }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save settings.');
      setSnapshot({ ...snapshot, settings: body.settings }); setValues(body.settings.value); setConfirmEndpoint(false);
      setAmounts(Object.fromEntries([...budgetFields, ...freePoolFields].map(([key]) => [key, microsToDollars(body.settings.value[key] ?? 0)])));
      setMessage('Saved. New requests will use these settings without a Vercel redeploy.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-5 p-6 text-text-primary">
    <div><h1 className="text-2xl font-semibold">AI Settings</h1>
      <p className="mt-1 text-text-secondary">Choose how Nucleas routes work and control shared usage. Manage credentials under <Link className="underline" href="/admin/ai/models">AI API keys</Link>.</p></div>
    {message && <p role="status" className="rounded border border-border p-3">{message}</p>}
    {!values || !snapshot ? <p>{message ? 'Reload this page to retry.' : 'Loading settings…'}</p> : <form onSubmit={save}>
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <section className="space-y-3 rounded border border-border p-4"><h2 className="text-lg font-semibold">Model routing</h2>
          <p className="text-sm text-text-secondary">Models are loaded from the configured inference endpoint. Changes apply to new work; the VPS model variable is only a fallback for older requests.</p>
          {modelError && <p className="text-sm text-warning">Could not refresh available models: {modelError} Existing selections remain available.</p>}
          <ModelSelect label="General reasoning" description="Planning, analysis, and ordinary text inference." value={values.model} models={models} onChange={model => setValues({ ...values, model })} />
          <ModelSelect label="Coding and repository work" description="IDE Build mode, repository edits, and command-driven verification." value={values.codingModel} models={models} onChange={codingModel => setValues({ ...values, codingModel })} />
          <ModelSelect label="Visual understanding" description="Screenshots, UI review, OCR, and image-aware work as those flows are enabled." value={values.visualModel} models={models} onChange={visualModel => setValues({ ...values, visualModel })} />
        </section>

        <section className="space-y-3 rounded border border-border p-4"><h2 className="text-lg font-semibold">Availability</h2>
          {([['planningEnabled', 'Allow AI features'], ['remoteEnabled', 'Connect to inference provider'], ['dispatchEnabled', 'Process queued requests']] as const).map(([key, label]) =>
            <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={values[key]} onChange={event => setValues({ ...values, [key]: event.target.checked })} />{label}</label>)}
          <p className="text-sm text-text-secondary">Inference credential: {snapshot.secrets.bearerTokenConfigured ? 'configured' : 'missing'} · Queue credential: {snapshot.secrets.cronSecretConfigured ? 'configured' : 'missing'} · Execution worker: {snapshot.secrets.executionWorkerUrlConfigured && snapshot.secrets.executionWorkerTokenConfigured ? 'ready' : 'not configured'}</p>
        </section>

        <AiDispatchUsage />

        <details className="rounded border border-border p-4"><summary className="cursor-pointer font-semibold">Connection and safety limits</summary>
          <div className="mt-4 space-y-4">
            <label className="block">Endpoint URL<input className={field} type="url" required maxLength={2048} value={values.endpoint} onChange={event => { setValues({ ...values, endpoint: event.target.value }); setConfirmEndpoint(false); }} /></label>
            {values.endpoint !== snapshot.settings.value.endpoint && <label className="flex gap-2"><input type="checkbox" required checked={confirmEndpoint} onChange={event => setConfirmEndpoint(event.target.checked)} />I authorize this endpoint to receive the server credential and selected request data.</label>}
            {([['dailyRequestLimit', 'Maximum attempts per UTC day', 1, 10000], ['minimumIntervalSeconds', 'Minimum seconds between attempts', 1, 86400], ['maxOutputTokens', 'Maximum output tokens per request', 256, 8192]] as const).map(([key, label, min, max]) =>
              <label className="block" key={key}>{label}<input className={field} type="number" required min={min} max={max} step={1} value={values[key]} onChange={event => setValues({ ...values, [key]: Number(event.target.value) })} /></label>)}
          </div>
        </details>

        <details className="rounded border border-border p-4"><summary className="cursor-pointer font-semibold">Budgets and free pool</summary>
          <div className="mt-4 space-y-4">
            {[...budgetFields, ...freePoolFields].map(([key, label]) => <label className="block" key={key}>{label} (USD)<input className={field} inputMode="decimal" required value={amounts[key]} onChange={event => setAmounts({ ...amounts, [key]: event.target.value })} /></label>)}
            <label className="flex gap-2"><input type="checkbox" checked={values.noProviderFee} onChange={event => setValues({ ...values, noProviderFee: event.target.checked })} />This endpoint has no provider inference fee.</label>
            <p className="text-sm text-text-secondary">A positive reservation is still required to bound concurrent requests. Project ceilings cannot exceed organization ceilings.</p>
          </div>
        </details>

        <details className="rounded border border-border p-4"><summary className="cursor-pointer font-semibold">Diagnostics</summary>
          <div className="mt-4 space-y-4"><ExecutionProbe kind="chat" /><ExecutionProbe /><AiDiagnostics /></div>
        </details>

        <button className="rounded bg-accent px-4 py-2 text-white" type="submit">{busy ? 'Saving…' : 'Save AI settings'}</button>
      </fieldset>
    </form>}
  </main>;
}
