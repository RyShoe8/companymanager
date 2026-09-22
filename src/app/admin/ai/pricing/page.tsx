'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AvailablePricingProvider,
  AvailablePricingSnapshot,
} from '@/lib/ai/pricing/availablePricing';

const HOUR = 60 * 60 * 1000;
const money = (value: number | null, free: boolean) => {
  if (free) return 'Free';
  if (value === null) return 'Unknown';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 6,
  }).format(value);
};

export default function AdminAiPricingPage() {
  const [snapshot, setSnapshot] = useState<AvailablePricingSnapshot | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = Date.now();
    setLoading(true);
    try {
      const response = await fetch('/api/admin/ai/pricing', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load available models.');
      if (!controller.signal.aborted) {
        const next = body as AvailablePricingSnapshot;
        setSnapshot(next);
        setSelectedProviderId((current) =>
          next.providers.some((item) => item.id === current)
            ? current
            : (next.providers[0]?.id ?? '')
        );
        setError('');
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Unable to load available models.');
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current >= HOUR) {
        void refresh();
      }
    };
    const timer = setInterval(refreshWhenVisible, HOUR);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  const selected = useMemo<AvailablePricingProvider | null>(
    () => snapshot?.providers.find((item) => item.id === selectedProviderId) ?? null,
    [selectedProviderId, snapshot]
  );
  const models = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (selected?.models ?? []).filter((model) =>
      !needle || model.id.toLowerCase().includes(needle)
    );
  }, [query, selected]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Available AI model pricing</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Only enabled providers and model IDs currently returned by their APIs are shown.
          Prices are USD per 1 million tokens. Rogly and other no-provider-fee credentials show as Free.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Provider
          <select
            className="mt-1 block min-w-64 rounded border border-border bg-background p-2"
            value={selectedProviderId}
            onChange={(event) => {
              setSelectedProviderId(event.target.value);
              setQuery('');
            }}
            disabled={loading || !snapshot?.providers.length}
          >
            {!snapshot?.providers.length ? <option value="">No configured providers</option> : null}
            {snapshot?.providers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}{item.free ? ' · Free' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Search this provider
          <input
            className="mt-1 block rounded border border-border bg-background p-2"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Exact model name"
          />
        </label>
        <button
          type="button"
          className="rounded border border-border px-3 py-2 disabled:opacity-50"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? 'Refreshing…' : 'Refresh availability'}
        </button>
      </div>

      {error ? <p role="alert" className="rounded border border-border p-3">{error}</p> : null}
      {snapshot ? (
        <p className="text-sm text-text-secondary">
          Checked {new Date(snapshot.fetchedAt).toLocaleString()}.
          {snapshot.referencePricingAvailable
            ? ' Pricing matched against the latest LiteLLM registry where available.'
            : ' The reference registry was unavailable; bundled rates are shown where available.'}
        </p>
      ) : null}

      {selected?.error ? (
        <p role="alert" className="rounded border border-border p-3">
          {selected.label}: {selected.error}
        </p>
      ) : null}

      {selected ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{selected.label}</h2>
            <span className="text-sm text-text-secondary">
              {models.length} of {selected.models.length} available models
            </span>
          </div>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Available models and token pricing for {selected.label}</caption>
              <thead>
                <tr>
                  {['Exact model ID', 'Input / 1M', 'Output / 1M', 'Cache read / 1M', 'Pricing source'].map((heading) => (
                    <th key={heading} scope="col" className="border-b border-border p-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id}>
                    <td className="border-b border-border p-3 font-mono break-all">{model.id}</td>
                    <td className="border-b border-border p-3">{money(model.input, model.free)}</td>
                    <td className="border-b border-border p-3">{money(model.output, model.free)}</td>
                    <td className="border-b border-border p-3">{money(model.cacheRead, model.free)}</td>
                    <td className="border-b border-border p-3">
                      {model.source}{model.variable ? ' · additional tiers may apply' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !models.length && !selected.error ? (
            <p>No matching models are available from this provider.</p>
          ) : null}
        </>
      ) : !loading ? (
        <p>No enabled AI provider credentials are configured. Add one on the AI Models page.</p>
      ) : null}
    </main>
  );
}
