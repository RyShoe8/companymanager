import { describe, expect, it } from 'vitest';
import { findReferencePricingRow, priceAvailableModel } from './availablePricing';
import type { PricingRow } from './liveCatalog';

const rows: PricingRow[] = [{
  id: 'openai/gpt-5.6-sol', provider: 'openai', mode: 'chat',
  input: 4, output: 20, cacheRead: 1, variable: false,
}];

describe('available model pricing', () => {
  it('matches exact API ids to a unique provider-prefixed reference id', () => {
    expect(findReferencePricingRow('gpt-5.6-sol', rows)?.id).toBe('openai/gpt-5.6-sol');
  });

  it('marks self-hosted models free regardless of public reference pricing', () => {
    expect(priceAvailableModel('Qwen/Qwen3', { free: true, referenceRows: rows })).toEqual({
      id: 'Qwen/Qwen3', input: 0, output: 0, cacheRead: 0, free: true,
      source: 'No provider fee', variable: false,
    });
  });

  it('preserves the exact discovered id while attaching live pricing', () => {
    expect(priceAvailableModel('gpt-5.6-sol', { free: false, referenceRows: rows })).toMatchObject({
      id: 'gpt-5.6-sol', input: 4, output: 20, cacheRead: 1, free: false,
      source: 'LiteLLM pricing registry',
    });
  });

  it('never treats missing paid pricing as free', () => {
    expect(priceAvailableModel('paid/unknown', { free: false, referenceRows: [] })).toMatchObject({
      input: null, output: null, free: false, source: 'Pricing unavailable',
    });
  });
});
