'use client';

import { useCallback, useEffect, useState } from 'react';
import { ideChatModes, type IdeChatMode } from '@/lib/ide/modes';

type Rule = {
  id: string;
  mode: IdeChatMode | 'all';
  title: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
};

type Props = {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
};

const modeOptions = [{ id: 'all' as const, label: 'All modes' }, ...ideChatModes];

export default function IdeTaskRulesPanel({ projectId, open, onClose }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<Rule['mode']>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setRules([]);
      return;
    }
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/rules`, {
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to load rules.');
    setRules(data.rules ?? []);
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load rules.'));
  }, [open, load]);

  async function createRule(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !title.trim() || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), mode, enabled: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to create rule.');
      setTitle('');
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create rule.');
    } finally {
      setBusy(false);
    }
  }

  async function patchRule(id: string, patch: Partial<Rule>) {
    if (!projectId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/ai/rules/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to update rule.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update rule.');
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(id: string) {
    if (!projectId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/ai/rules/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete rule.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete rule.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-background-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Task rules</h2>
          <button type="button" className="text-sm text-text-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mb-3 text-xs text-text-secondary">
          Rules are injected into chat system context for the matching mode (and All). Use them to encode
          repeat workflows and stop recurring mistakes.
        </p>
        {error ? <p className="mb-2 text-xs text-red-500">{error}</p> : null}
        <ul className="mb-4 space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded border border-border p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-text-primary">{rule.title}</div>
                  <div className="text-[11px] text-text-secondary">
                    {rule.mode} · {rule.enabled ? 'enabled' : 'disabled'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-0.5 text-xs"
                    disabled={busy}
                    onClick={() => void patchRule(rule.id, { enabled: !rule.enabled })}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-0.5 text-xs"
                    disabled={busy}
                    onClick={() => void removeRule(rule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{rule.body}</p>
            </li>
          ))}
          {rules.length === 0 ? <li className="text-xs text-text-secondary">No rules yet.</li> : null}
        </ul>
        <form onSubmit={createRule} className="space-y-2 border-t border-border pt-3">
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!projectId || busy}
          />
          <select
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as Rule['mode'])}
            disabled={!projectId || busy}
          >
            {modeOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <textarea
            className="h-24 w-full rounded border border-border bg-background px-2 py-1 text-sm"
            placeholder="Rule body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={!projectId || busy}
          />
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={!projectId || busy || !title.trim() || !body.trim()}
          >
            Add rule
          </button>
        </form>
      </div>
    </div>
  );
}
