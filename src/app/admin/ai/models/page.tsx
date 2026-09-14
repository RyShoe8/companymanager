'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MODEL_PROVIDERS,
  getModelProvider,
  type ModelProviderId,
} from '@/lib/ai/rolePipeline/providerCatalog';

const field = 'block w-full rounded border border-border bg-background p-2 text-text-primary';
const button = 'rounded border border-border px-3 py-2 text-sm disabled:opacity-50';
const help = 'mt-1 text-xs text-text-secondary';

type Profile = {
  id: string;
  key: string;
  label: string;
  provider?: string;
  tier: 'commercial' | 'local_remote';
  endpoint: string;
  model: string;
  secretLast4: string;
  enabled: boolean;
};

type FormState = {
  provider: ModelProviderId;
  tier: 'commercial' | 'local_remote';
  label: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  labelTouched: boolean;
};

function formFromProvider(providerId: ModelProviderId): FormState {
  const provider = getModelProvider(providerId) ?? MODEL_PROVIDERS[0]!;
  return {
    provider: provider.id,
    tier: provider.defaultTier,
    label: provider.label,
    endpoint: provider.endpoint,
    apiKey: '',
    enabled: true,
    labelTouched: false,
  };
}

export default function AdminAiModelsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState<FormState>(() => formFromProvider('openai'));
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [rotateKey, setRotateKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const provider = useMemo(() => getModelProvider(form.provider), [form.provider]);
  const isCustom = form.provider === 'custom';

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/ai/models', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load company credentials.');
    setProfiles(body.profiles ?? []);
  }, []);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Load failed.'));
  }, [load]);

  function selectProvider(providerId: ModelProviderId) {
    setForm(formFromProvider(providerId));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          provider: form.provider,
          tier: form.tier,
          endpoint: form.endpoint || undefined,
          apiKey: form.apiKey,
          enabled: form.enabled,
          protocol: 'openai-chat',
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save credential.');
      setForm(formFromProvider(form.provider));
      await load();
      setMessage(
        'Company credential saved. AI Team can now pick any model from this company without creating another key.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: string) {
    if (!rotateKey.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/ai/models/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: rotateKey.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to rotate key.');
      setRotateId(null);
      setRotateKey('');
      await load();
      setMessage('API key rotated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rotate failed.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(profile: Profile) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/ai/models/${encodeURIComponent(profile.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !profile.enabled }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to update credential.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        'Delete this company credential? Role pipelines that use it will fail closed until rebound.'
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/ai/models/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to delete credential.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6 text-text-primary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">AI model registry</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Add one API key per company. That unlocks every catalog model for that company on AI Team — pick the
            model there, not here.
          </p>
        </div>
        <Link className="underline text-sm" href="/admin/ai">
          Back to AI Settings
        </Link>
      </div>
      {message ? <p role="status" className="rounded border border-border p-3">{message}</p> : null}

      <section className="space-y-3 rounded border border-border p-4">
        <h2 className="text-lg font-semibold">Company credentials</h2>
        {profiles.length === 0 ? <p className="text-sm text-text-secondary">No credentials yet.</p> : null}
        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{profile.label}</div>
                  <div className="text-xs text-text-secondary">
                    {(profile.provider ?? 'custom') + ' · ' + profile.tier}
                    {profile.enabled ? '' : ' · disabled'}
                  </div>
                  <div className="text-xs text-text-secondary break-all">{profile.endpoint}</div>
                  <div className="text-xs text-text-secondary">API key …{profile.secretLast4}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={button} disabled={busy} onClick={() => void toggleEnabled(profile)}>
                    {profile.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setRotateId(profile.id);
                      setRotateKey('');
                    }}
                  >
                    Rotate API key
                  </button>
                  <button type="button" className={button} disabled={busy} onClick={() => void remove(profile.id)}>
                    Delete
                  </button>
                </div>
              </div>
              {rotateId === profile.id ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className={`${field} max-w-md`}
                    type="password"
                    placeholder="New API key"
                    value={rotateKey}
                    onChange={(event) => setRotateKey(event.target.value)}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className={button}
                    disabled={busy || !rotateKey.trim()}
                    onClick={() => void rotate(profile.id)}
                  >
                    Save key
                  </button>
                  <button type="button" className={button} disabled={busy} onClick={() => setRotateId(null)}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={create} className="space-y-3 rounded border border-border p-4">
        <h2 className="text-lg font-semibold">Add company credential</h2>

        <label className="block text-sm">
          Company
          <select
            className={`${field} mt-1`}
            value={form.provider}
            onChange={(event) => selectProvider(event.target.value as ModelProviderId)}
            disabled={busy}
          >
            {MODEL_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <p className={help}>
            {provider?.hint}
            {!isCustom
              ? ` Unlocks ${(provider?.models.length ?? 0)} catalog models for AI Team to choose per role.`
              : ''}
          </p>
        </label>

        <label className="block text-sm">
          Role hint
          <select
            className={`${field} mt-1`}
            value={form.tier}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                tier: event.target.value as 'commercial' | 'local_remote',
              }))
            }
            disabled={busy}
          >
            <option value="commercial">Commercial (usually Planner / Reviewer)</option>
            <option value="local_remote">Local / self-hosted (usually Worker)</option>
          </select>
        </label>

        <label className="block text-sm">
          Endpoint
          <input
            className={`${field} mt-1`}
            type="url"
            required={isCustom}
            value={form.endpoint}
            onChange={(event) => setForm((current) => ({ ...current, endpoint: event.target.value }))}
            disabled={busy || !isCustom}
            readOnly={!isCustom}
          />
          <p className={help}>
            {isCustom
              ? 'Enter your host’s OpenAI-compatible chat completions URL.'
              : 'Filled from the company. Model choice happens on AI Team.'}
          </p>
        </label>

        <label className="block text-sm">
          Display name
          <input
            className={`${field} mt-1`}
            required
            value={form.label}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                label: event.target.value,
                labelTouched: true,
              }))
            }
            disabled={busy}
          />
          <p className={help}>Shown on AI Team when picking a company credential (e.g. “OpenAI”).</p>
        </label>

        <label className="block text-sm">
          API key
          <input
            className={`${field} mt-1`}
            type="password"
            required
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
            disabled={busy}
            autoComplete="off"
            placeholder="Paste the provider secret"
          />
          <p className={help}>Stored encrypted. One key unlocks all models for this company.</p>
        </label>

        <button className={button} disabled={busy || (isCustom && !form.endpoint.trim())}>
          {busy ? 'Saving…' : 'Save company credential'}
        </button>
      </form>
    </main>
  );
}
