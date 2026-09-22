import type { PricingRow } from '@/lib/ai/pricing/liveCatalog';
import { lookupModelTokenRate } from '@/lib/ai/pricing/modelRates';

export type AvailablePricingModel = {
  id: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  free: boolean;
  source: string;
  variable: boolean;
};

export type AvailablePricingProvider = {
  id: string;
  label: string;
  provider: string;
  free: boolean;
  models: AvailablePricingModel[];
  error: string | null;
};

export type AvailablePricingSnapshot = {
  fetchedAt: string;
  referencePricingAvailable: boolean;
  providers: AvailablePricingProvider[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Match an exact API model id to LiteLLM's sometimes provider-prefixed pricing id. */
export function findReferencePricingRow(modelId: string, rows: PricingRow[]): PricingRow | null {
  const model = normalize(modelId);
  if (!model) return null;
  const exact = rows.find((row) => normalize(row.id) === model);
  if (exact) return exact;
  const suffix = rows.filter((row) => {
    const id = normalize(row.id);
    return id.endsWith('/' + model) || model.endsWith('/' + id);
  });
  return suffix.length === 1 ? suffix[0]! : null;
}

export function priceAvailableModel(
  modelId: string,
  options: { free: boolean; referenceRows: PricingRow[] }
): AvailablePricingModel {
  if (options.free) {
    return {
      id: modelId, input: 0, output: 0, cacheRead: 0, free: true,
      source: 'No provider fee', variable: false,
    };
  }
  const live = findReferencePricingRow(modelId, options.referenceRows);
  if (live) {
    return {
      id: modelId, input: live.input, output: live.output, cacheRead: live.cacheRead,
      free: false, source: 'LiteLLM pricing registry', variable: live.variable,
    };
  }
  const fallback = lookupModelTokenRate(modelId);
  return {
    id: modelId,
    input: fallback ? fallback.inputMicrosPer1M / 1_000_000 : null,
    output: fallback ? fallback.outputMicrosPer1M / 1_000_000 : null,
    cacheRead: null,
    free: false,
    source: fallback?.source ?? 'Pricing unavailable',
    variable: false,
  };
}
