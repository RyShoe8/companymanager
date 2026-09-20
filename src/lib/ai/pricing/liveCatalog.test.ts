import { describe, expect, it, vi } from 'vitest';
import { fetchPricingCatalog, parsePricingCatalog, PRICING_SOURCE } from './liveCatalog';

const data = {
  sample_spec: {litellm_provider: 'sample', mode: 'chat'},
  'provider/model': {litellm_provider: 'provider', mode: 'chat', input_cost_per_token: 0.000002, output_cost_per_token: 0, cache_read_input_token_cost: 0.0000005, input_cost_per_token_above_128k_tokens: 0.000004},
  unknown: {litellm_provider: 'provider', mode: 'chat', input_cost_per_token: -1, output_cost_per_token: '0.5'},
  image: {litellm_provider: 'provider', mode: 'image_generation', output_cost_per_image: 0.04},
};
describe('pricing catalog', () => {
  it('converts per-token USD, preserves zero and unknown, and flags tiers', () => {
    const rows = parsePricingCatalog(data);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({id: 'provider/model', input: 2, output: 0, cacheRead: 0.5, variable: true});
    expect(rows[1]).toMatchObject({input: null, output: null, cacheRead: null});
  });
  it.each([null, [], {}, {model: {mode: 'chat'}}])('rejects invalid or empty catalogs', body => {
    expect(() => parsePricingCatalog(body)).toThrow();
  });
  it('fetches only the fixed public source without credentials or redirects', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
    const snapshot = await fetchPricingCatalog(fetcher);
    expect(fetcher).toHaveBeenCalledWith(PRICING_SOURCE, expect.objectContaining({cache: 'no-store', redirect: 'error', headers: {Accept: 'application/json'}}));
    expect(Number.isFinite(Date.parse(snapshot.fetchedAt))).toBe(true);
    expect(snapshot.rows).toHaveLength(2);
  });
  it('rejects failed HTTP and malformed responses', async () => {
    await expect(fetchPricingCatalog(vi.fn().mockResolvedValue(new Response('', {status: 503})))).rejects.toThrow();
    await expect(fetchPricingCatalog(vi.fn().mockResolvedValue(new Response('invalid')))).rejects.toThrow();
  });
});

