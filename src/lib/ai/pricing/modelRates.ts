import { dollarsToMicros } from '@/lib/ai/settingsSchema';

/**
 * Provider list prices for OpenAI-compatible chat models (USD per 1M tokens).
 * Used to settle request costMicros from reported usage. Not invoice reconciliation —
 * missing rates or usage stay unknown (null), never invent $0.
 *
 * Rates checked against public provider pricing pages around 2026-09-14.
 * Prefer Standard / short-context list prices (no cache discount, no long-context uplift).
 */
export type ModelTokenRate = {
  /** Micro-USD charged per 1M input tokens. */
  inputMicrosPer1M: number;
  /** Micro-USD charged per 1M output tokens. */
  outputMicrosPer1M: number;
  /** Short provenance note for audits. */
  source: string;
};

function rate(inputUsdPer1M: string, outputUsdPer1M: string, source: string): ModelTokenRate {
  return {
    inputMicrosPer1M: dollarsToMicros(inputUsdPer1M),
    outputMicrosPer1M: dollarsToMicros(outputUsdPer1M),
    source,
  };
}

/** Canonical model id (lowercase) → rate. Aliases and provider-prefixed ids map here too. */
export const MODEL_TOKEN_RATES: Record<string, ModelTokenRate> = {
  // OpenAI — developers.openai.com/api/docs/pricing (Standard short-context)
  'gpt-6-astra': rate('10', '50', 'openai-pricing-2026-09'),
  'gpt-5.6-sol': rate('4', '20', 'openai-pricing-2026-09-sol-promo'),
  'gpt-5.6-terra': rate('2', '12', 'openai-pricing-2026-09'),
  'gpt-5.6-luna': rate('0.2', '1.2', 'openai-pricing-2026-09'),
  'gpt-5.4': rate('2.5', '15', 'openai-model-card-2026-09'),
  'gpt-5.4-mini': rate('0.75', '4.5', 'openai-model-card-2026-09'),
  'gpt-5': rate('1.25', '10', 'openai-legacy-sheet-2026-09'),
  'gpt-5-mini': rate('0.25', '2', 'openai-legacy-sheet-2026-09'),
  o3: rate('2', '8', 'openai-legacy-sheet-2026-09'),
  'o4-mini': rate('1.1', '4.4', 'openai-legacy-sheet-2026-09'),
  'gpt-4.1': rate('2', '8', 'openai-legacy-sheet-2026-09'),
  'gpt-4.1-mini': rate('0.4', '1.6', 'openai-legacy-sheet-2026-09'),
  'gpt-4o': rate('2.5', '10', 'openai-legacy-sheet-2026-09'),
  'gpt-4o-mini': rate('0.15', '0.6', 'openai-legacy-sheet-2026-09'),

  // Anthropic — platform.claude.com pricing (via OpenRouter ids or bare)
  'claude-opus-5': rate('5', '25', 'anthropic-pricing-2026-09'),
  'claude-opus-4.8': rate('5', '25', 'anthropic-pricing-2026-09'),
  'claude-sonnet-5': rate('2', '10', 'anthropic-pricing-2026-09'),
  'claude-sonnet-4.6': rate('3', '15', 'anthropic-pricing-2026-09'),
  'claude-sonnet-4': rate('3', '15', 'anthropic-pricing-2026-09'),
  'claude-haiku-4.5': rate('1', '5', 'anthropic-pricing-2026-09'),
  'claude-3.5-sonnet': rate('3', '15', 'anthropic-legacy-2026-09'),
  'claude-3.5-haiku': rate('0.8', '4', 'anthropic-legacy-2026-09'),

  // Google Gemini — ai.google.dev/gemini-api/docs/pricing (paid standard, ≤200k where stepped)
  'gemini-3.1-pro-preview': rate('2', '12', 'google-gemini-pricing-2026-09'),
  'gemini-3.8-flash': rate('0.75', '3.75', 'google-gemini-pricing-2026-09'),
  'gemini-3.7-flash': rate('0.75', '3.75', 'google-gemini-pricing-2026-09'),
  'gemini-3.6-flash': rate('0.75', '3.75', 'google-gemini-pricing-2026-09'),
  'gemini-3.5-flash': rate('1.5', '9', 'google-gemini-pricing-2026-09'),
  'gemini-3.5-flash-lite': rate('0.3', '2.5', 'google-gemini-pricing-2026-09'),
  'gemini-2.5-pro': rate('1.25', '10', 'google-gemini-pricing-2026-09'),
  'gemini-2.5-flash': rate('0.3', '2.5', 'google-gemini-pricing-2026-09'),
  'gemini-2.5-flash-lite': rate('0.1', '0.4', 'google-gemini-pricing-2026-09'),

  // Groq — console.groq.com/docs/models
  'openai/gpt-oss-120b': rate('0.15', '0.6', 'groq-docs-2026-09'),
  'openai/gpt-oss-20b': rate('0.075', '0.3', 'groq-docs-2026-09'),
  'qwen/qwen3.8-27b': rate('0.8', '4', 'groq-docs-2026-09'),
  'qwen/qwen3.6-27b': rate('0.6', '3', 'groq-docs-2026-09'),

  // DeepSeek — api-docs.deepseek.com (off-peak cache-miss for flash family)
  'deepseek-flash': rate('0.15', '0.6', 'deepseek-pricing-2026-09-offpeak'),
  'deepseek-chat': rate('0.15', '0.6', 'deepseek-legacy-alias-flash'),
  'deepseek-reasoner': rate('0.15', '0.6', 'deepseek-legacy-alias-flash'),

  // Together AI — together.ai/pricing / aggregator cross-check 2026-09
  'meta-llama/llama-4-maverick-17b-128e-instruct-fp8': rate('0.27', '0.85', 'together-pricing-2026-09'),
  'meta-llama/llama-4-scout-17b-16e-instruct': rate('0.18', '0.59', 'together-pricing-2026-09'),
  'deepseek-ai/deepseek-r1': rate('3', '7', 'together-pricing-2026-09'),
  'qwen/qwen3-235b-a22b-fp8-tput': rate('0.2', '0.6', 'together-pricing-2026-09'),
  'meta-llama/meta-llama-3.1-70b-instruct-turbo': rate('0.88', '0.88', 'together-pricing-2026-09'),
  'meta-llama/meta-llama-3.1-8b-instruct-turbo': rate('0.18', '0.18', 'together-pricing-2026-09'),

  // Fireworks — fireworks pricing / genai-prices cross-check
  'accounts/fireworks/models/llama4-maverick-instruct-basic': rate('0.22', '0.88', 'fireworks-pricing-2026-09'),
  'accounts/fireworks/models/llama4-scout-instruct-basic': rate('0.15', '0.6', 'fireworks-pricing-2026-09'),
  'accounts/fireworks/models/deepseek-r1-0528': rate('3', '8', 'fireworks-pricing-2026-09'),
  'accounts/fireworks/models/deepseek-r1': rate('3', '8', 'fireworks-pricing-2026-09'),
  'accounts/fireworks/models/qwen3-235b-a22b': rate('0.9', '0.9', 'fireworks-size-tier-2026-09'),
  'accounts/fireworks/models/llama-v3p3-70b-instruct': rate('0.9', '0.9', 'fireworks-size-tier-2026-09'),
  'accounts/fireworks/models/llama-v3p1-8b-instruct': rate('0.2', '0.2', 'fireworks-size-tier-2026-09'),

  // OpenRouter catalog slugs (underlying provider list prices)
  'openai/gpt-5.6-sol': rate('4', '20', 'openrouter-via-openai-2026-09'),
  'openai/gpt-5.6-terra': rate('2', '12', 'openrouter-via-openai-2026-09'),
  'anthropic/claude-opus-5': rate('5', '25', 'openrouter-via-anthropic-2026-09'),
  'anthropic/claude-sonnet-5': rate('2', '10', 'openrouter-via-anthropic-2026-09'),
  'google/gemini-2.5-pro': rate('1.25', '10', 'openrouter-via-google-2026-09'),
  'google/gemini-2.5-flash': rate('0.3', '2.5', 'openrouter-via-google-2026-09'),
  'deepseek/deepseek-r1': rate('3', '7', 'openrouter-via-deepseek-2026-09'),
  'meta-llama/llama-4-maverick': rate('0.27', '0.85', 'openrouter-via-meta-2026-09'),
};

const PROVIDER_PREFIXES = [
  'openai/',
  'anthropic/',
  'google/',
  'deepseek/',
  'meta-llama/',
  'qwen/',
  'accounts/fireworks/models/',
] as const;

export function normalizeModelRateKey(model: string): string {
  return model.trim().toLowerCase();
}

/** Resolve a rate for a model id, trying bare and provider-prefixed forms. */
export function lookupModelTokenRate(model: string): ModelTokenRate | null {
  const key = normalizeModelRateKey(model);
  if (!key) return null;
  if (MODEL_TOKEN_RATES[key]) return MODEL_TOKEN_RATES[key]!;

  for (const prefix of PROVIDER_PREFIXES) {
    if (key.startsWith(prefix)) {
      const bare = key.slice(prefix.length);
      if (MODEL_TOKEN_RATES[bare]) return MODEL_TOKEN_RATES[bare]!;
      // Anthropic OpenRouter ids are anthropic/claude-… — also try without anthropic/
      continue;
    }
    const prefixed = `${prefix}${key}`;
    if (MODEL_TOKEN_RATES[prefixed]) return MODEL_TOKEN_RATES[prefixed]!;
  }

  // OpenRouter-style anthropic/claude-opus-5 already in table; bare claude-* covered above.
  if (key.startsWith('anthropic/')) {
    const bare = key.slice('anthropic/'.length);
    if (MODEL_TOKEN_RATES[bare]) return MODEL_TOKEN_RATES[bare]!;
  }
  return null;
}

function tokensToMicros(tokens: number, microsPer1M: number): number {
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Invalid token count.');
  if (!Number.isSafeInteger(microsPer1M) || microsPer1M < 0) throw new Error('Invalid rate.');
  return Number((BigInt(tokens) * BigInt(microsPer1M)) / BigInt(1_000_000));
}

/**
 * Estimate settled micro-USD from provider usage + list rates.
 * Returns null when rate or usage is missing (retain reservation; never invent zero).
 */
export function estimateCostMicros(input: {
  model: string;
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
}): number | null {
  const rateRow = lookupModelTokenRate(input.model);
  if (!rateRow) return null;
  if (input.inputTokens == null || input.outputTokens == null) return null;
  if (!Number.isSafeInteger(input.inputTokens) || !Number.isSafeInteger(input.outputTokens)) return null;
  if (input.inputTokens < 0 || input.outputTokens < 0) return null;

  const total =
    tokensToMicros(input.inputTokens, rateRow.inputMicrosPer1M) +
    tokensToMicros(input.outputTokens, rateRow.outputMicrosPer1M);
  if (!Number.isSafeInteger(total) || total < 0) return null;
  return total;
}

/** Settle rule shared by chat + pipeline stages. */
export function resolveSettledCostMicros(input: {
  noProviderFee: boolean;
  model: string;
  inputTokens: number | null | undefined;
  outputTokens: number | null | undefined;
}): number | null {
  if (input.noProviderFee) return 0;
  return estimateCostMicros(input);
}
