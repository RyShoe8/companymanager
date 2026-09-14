'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const field = 'block w-full rounded border border-border bg-background p-2 text-text-primary';
const button = 'rounded border border-border px-3 py-2 text-sm disabled:opacity-50';

type Profile = {
  id: string;
  key: string;
  label: string;
  tier: 'commercial' | 'local_remote';
  endpoint: string;
  model: string;
  secretLast4: string;
  enabled: boolean;
};

const emptyForm = {
  key: '',
  label: '',
  tier: 'commercial' as const,
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  apiKey: '',
  enabled: true,
};

export default function AdminAiModelsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState<{
    key: string;
    label: string;
    tier: 'commercial' | 'local_remote';
    endpoint: string;
    model: string;
    apiKey: string;
    enabled: boolean;
  }>(emptyForm);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [rotateKey, setRotateKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/ai/models', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load model profiles.');
    setProfiles(body.profiles ?? []);
  }, []);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Load failed.'));
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to create profile.');
      setForm(emptyForm);
      await load();
      setMessage('Model profile saved. API key is stored encrypted and is not shown again.');
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
      if (!response.ok) throw new Error(body.error ?? 'Unable to update profile.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this model profile? Role pipelines that reference it will fail closed until rebound.')) {
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/ai/models/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to delete profile.');
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
            Commercial and local-remote model profiles for role pipelines. API keys are entered here (not as
            provider env vars), encrypted at rest, and never returned in full.
          </p>
        </div>
        <Link className="underline text-sm" href="/admin/ai">
          Back to AI Settings
        </Link>
      </div>
      {message ? <p role="status" className="rounded border border-border p-3">{message}</p> : null}

      <section className="space-y-3 rounded border border-border p-4">
        <h2 className="text-lg font-semibold">Existing profiles</h2>
        {profiles.length === 0 ? <p className="text-sm text-text-secondary">No profiles yet.</p> : null}
        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {profile.label}{' '}
                    <span className="text-text-secondary font-normal">
                      ({profile.tier} · {profile.key})
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary break-all">
                    {profile.model} @ {profile.endpoint}
                  </div>
                  <div className="text-xs text-text-secondary">
                    Key …{profile.secretLast4} · {profile.enabled ? 'enabled' : 'disabled'}
                  </div>
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
                    Rotate key
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
                    placeholder="New API key / bearer"
                    value={rotateKey}
                    onChange={(event) => setRotateKey(event.target.value)}
                    disabled={busy}
                  />
                  <button type="button" className={button} disabled={busy || !rotateKey.trim()} onClick={() => void rotate(profile.id)}>
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
        <h2 className="text-lg font-semibold">Add profile</h2>
        <label className="block text-sm">
          Key
          <input
            className={`${field} mt-1`}
            required
            value={form.key}
            onChange={(event) => setForm({ ...form, key: event.target.value })}
            placeholder="openai-planner"
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Label
          <input
            className={`${field} mt-1`}
            required
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Tier
          <select
            className={`${field} mt-1`}
            value={form.tier}
            onChange={(event) =>
              setForm({
                ...form,
                tier: event.target.value as 'commercial' | 'local_remote',
                endpoint:
                  event.target.value === 'commercial'
                    ? 'https://api.openai.com/v1/chat/completions'
                    : form.endpoint,
              })
            }
            disabled={busy}
          >
            <option value="commercial">commercial (API planner/reviewer)</option>
            <option value="local_remote">local_remote (worker host)</option>
          </select>
        </label>
        <label className="block text-sm">
          Endpoint
          <input
            className={`${field} mt-1`}
            type="url"
            required
            value={form.endpoint}
            onChange={(event) => setForm({ ...form, endpoint: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Model id
          <input
            className={`${field} mt-1`}
            required
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          API key / bearer
          <input
            className={`${field} mt-1`}
            type="password"
            required
            value={form.apiKey}
            onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <button className={button} disabled={busy}>
          {busy ? 'Saving…' : 'Create profile'}
        </button>
      </form>
    </main>
  );
}
