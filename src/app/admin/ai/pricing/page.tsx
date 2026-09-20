'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PRICING_SOURCE_PAGE, type PricingSnapshot } from '@/lib/ai/pricing/liveCatalog';
import { MODEL_TOKEN_RATES } from '@/lib/ai/pricing/modelRates';

const money = (value: number | null) => value === null ? 'Unknown' : new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 6,
}).format(value);
const HOUR = 60 * 60 * 1000;

export default function AdminAiPricingPage() {
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(0);
  const [view, setView] = useState('live');
  const request = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = Date.now();
    setLoading(true);
    try {
      const response = await fetch('/api/admin/ai/pricing', { cache: 'no-store', signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load pricing.');
      if (!controller.signal.aborted) { setSnapshot(body); setError(''); }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load pricing.');
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current >= HOUR) void refresh();
    };
    const timer = setInterval(onVisible, HOUR);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  const providers = useMemo(() => [...new Set(snapshot?.rows.map(row => row.provider) ?? [])].sort(), [snapshot]);
  const rows = useMemo(() => (snapshot?.rows ?? []).filter(row =>
    (!provider || row.provider === provider) &&
    (row.id + ' ' + row.provider).toLowerCase().includes(query.toLowerCase())
  ), [snapshot, provider, query]);
  const estimates = Object.entries(MODEL_TOKEN_RATES).filter(([id]) => id.includes(query.toLowerCase()));
  return <main className="mx-auto max-w-7xl p-6 space-y-5">
    <h1 className="text-2xl font-semibold">AI model pricing</h1>
    <p className="text-sm text-text-secondary">USD per 1 million tokens. Reference list prices, not an invoice or guaranteed quote.
      Refreshes on opening this page and hourly while visible; no background inference calls or API keys required.</p>
    <div className="flex flex-wrap gap-3 items-center">
      <button className="rounded border border-border px-3 py-2 disabled:opacity-50" disabled={loading} onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh prices'}</button>
      <a className="text-primary underline" href={PRICING_SOURCE_PAGE} target="_blank" rel="noopener noreferrer">LiteLLM pricing source</a>
      <span className="text-sm">Last successful fetch: {snapshot ? new Date(snapshot.fetchedAt).toLocaleString() : 'Not yet available'}</span>
    </div>
    {error && <p role="alert" className="rounded border border-border p-3">{error}</p>}
    <p className="text-sm text-text-secondary">Fresh retrieval does not mean every rate was recently verified by its provider.
      LiteLLM maintains this registry; changes may lag. Context tiers, batch discounts, cache writes, images, audio,
      tools, taxes, and negotiated rates can change your bill. Missing values are unknown, not free.
      Rogly/private aliases require host-specific pricing; public model prices do not establish your host’s fee.</p>
    <div className="flex flex-wrap gap-3">
      <label>View <select className="bg-background border border-border p-2" value={view} onChange={e => {setView(e.target.value); setPage(0);}}>
        <option value="live">Published reference rates</option><option value="estimates">Nucleas settlement estimates (static)</option>
      </select></label>
      <label>Search models <input className="bg-background border border-border p-2" value={query} onChange={e => {setQuery(e.target.value); setPage(0);}} /></label>
      {view === 'live' && <label>Provider <select className="bg-background border border-border p-2" value={provider} onChange={e => {setProvider(e.target.value); setPage(0);}}>
        <option value="">All providers</option>{providers.map(id => <option key={id}>{id}</option>)}
      </select></label>}
    </div>
    {view === 'live' ? <>
      <p className="text-sm">{rows.length} matching models. {snapshot && error ? 'Showing the previous snapshot — refresh failed.' : 'Base token rates from the latest successful fetch.'}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left">
        <caption className="sr-only">Published base token prices in USD per million tokens</caption>
        <thead><tr>{['Provider / model ID', 'Mode', 'Input / 1M', 'Output / 1M', 'Cache read / 1M', 'Conditions'].map(h => <th scope="col" className="p-3 border-b border-border" key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(page * 50, (page + 1) * 50).map(row => <tr key={row.id}>
          <td className="p-3 border-b border-border break-all">{row.provider}<br/><span className="font-mono">{row.id}</span></td>
          <td>{row.mode}</td><td>{money(row.input)}</td><td>{money(row.output)}</td><td>{money(row.cacheRead)}</td><td>{row.variable ? 'Additional rates / tiers; inspect source' : 'Verify provider terms'}</td>
        </tr>)}</tbody>
      </table></div>
      {!loading && !rows.length && <p>No matching reference rates available.</p>}
      <div className="flex gap-4 items-center"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page + 1} of {Math.max(1, Math.ceil(rows.length / 50))}</span>
        <button disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </> : <>
      <p className="text-sm">These are the bundled rates used for Nucleas cost estimates, not the live registry.
        Refreshing reference prices does not change settlement rates or rewrite historical costs. Source labels are legacy provenance, not a fresh verification.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Model ID</th><th>Input / 1M</th><th>Output / 1M</th><th>Bundled source label</th></tr></thead>
        <tbody>{estimates.map(([id, rate]) => <tr key={id}><td className="py-2">{id}</td><td>{money(rate.inputMicrosPer1M / 1e6)}</td><td>{money(rate.outputMicrosPer1M / 1e6)}</td><td>{rate.source}</td></tr>)}</tbody>
      </table></div>
    </>}
  </main>;
}

