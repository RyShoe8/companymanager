/** Catalog of OpenAI-compatible chat providers for the Admin model registry. */

export type ModelProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'deepseek'
  | 'together'
  | 'fireworks'
  | 'openrouter'
  | 'custom';

export type ModelProviderOption = {
  id: ModelProviderId;
  label: string;
  /** Default chat-completions endpoint (OpenAI-compatible). */
  endpoint: string;
  /** Model id → display name */
  models: { id: string; label: string }[];
  /** Shown under the company field */
  hint: string;
  /** Suggested tier when this company is selected */
  defaultTier: 'commercial' | 'local_remote';
};

/**
 * Phase 1 gateway speaks OpenAI chat completions only.
 * Anthropic is listed via OpenRouter’s OpenAI-compatible API (use an OpenRouter key).
 * Google uses Gemini’s OpenAI-compatible endpoint with a Gemini API key.
 */
export const MODEL_PROVIDERS: ModelProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your OpenAI API key (sk-…).',
    models: [
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (via OpenRouter)',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Claude through OpenRouter’s OpenAI-compatible API. Use an OpenRouter API key (not a raw Anthropic key) until native Anthropic support ships.',
    models: [
      { id: 'anthropic/claude-opus-5', label: 'Claude Opus 5' },
      { id: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8' },
      { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'google',
    label: 'Google',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your Gemini API key from Google AI Studio. Uses Google’s OpenAI-compatible chat endpoint.',
    models: [
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your Groq API key.',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
      { id: 'qwen/qwen3.8-27b', label: 'Qwen3.8 27B' },
      { id: 'qwen/qwen3.6-27b', label: 'Qwen3.6 27B' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your DeepSeek API key.',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your Together API key.',
    models: [
      { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', label: 'Llama 4 Maverick' },
      { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout' },
      { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1' },
      { id: 'Qwen/Qwen3-235B-A22B-fp8-tput', label: 'Qwen3 235B' },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Turbo' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Turbo' },
    ],
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your Fireworks API key.',
    models: [
      { id: 'accounts/fireworks/models/llama4-maverick-instruct-basic', label: 'Llama 4 Maverick' },
      { id: 'accounts/fireworks/models/llama4-scout-instruct-basic', label: 'Llama 4 Scout' },
      { id: 'accounts/fireworks/models/deepseek-r1-0528', label: 'DeepSeek R1 (0528)' },
      { id: 'accounts/fireworks/models/deepseek-r1', label: 'DeepSeek R1 (Fast)' },
      { id: 'accounts/fireworks/models/qwen3-235b-a22b', label: 'Qwen3 235B' },
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B' },
      { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct', label: 'Llama 3.1 8B' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'One key for many providers. Paste your OpenRouter API key.',
    models: [
      { id: 'openai/gpt-5.6-sol', label: 'OpenAI GPT-5.6 Sol' },
      { id: 'openai/gpt-5.6-terra', label: 'OpenAI GPT-5.6 Terra' },
      { id: 'anthropic/claude-opus-5', label: 'Anthropic Claude Opus 5' },
      { id: 'anthropic/claude-sonnet-5', label: 'Anthropic Claude Sonnet 5' },
      { id: 'google/gemini-2.5-pro', label: 'Google Gemini 2.5 Pro' },
      { id: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
      { id: 'meta-llama/llama-4-maverick', label: 'Meta Llama 4 Maverick' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom / self-hosted',
    endpoint: '',
    defaultTier: 'local_remote',
    hint: 'Your OpenAI-compatible host (e.g. friend’s inference server). Enter endpoint and model id yourself.',
    models: [],
  },
];

export function getModelProvider(id: string): ModelProviderOption | undefined {
  return MODEL_PROVIDERS.find((item) => item.id === id);
}

/** True when the model id is allowed for this company credential. */
export function isModelAllowedForProvider(provider: string, model: string): boolean {
  const trimmed = model.trim();
  if (!trimmed) return false;
  if (provider === 'custom') return true;
  const catalog = getModelProvider(provider);
  if (!catalog) return false;
  return catalog.models.some((item) => item.id === trimmed);
}

export function slugifyModelKey(parts: string[]): string {
  const base = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
  const suffix = Date.now().toString(36).slice(-4);
  const key = `${base || 'model'}-${suffix}`;
  return /^[a-z]/.test(key) ? key : `m-${key}`.slice(0, 64);
}

/** Company-only name for UI (never includes a model suffix). */
export function companyDisplayName(input: { label: string; provider?: string | null }): string {
  const provider = input.provider ?? 'custom';
  const catalog = getModelProvider(provider);
  if (catalog && provider !== 'custom') return catalog.label;
  const label = input.label.trim();
  const sep = label.indexOf(' · ');
  if (sep > 0) {
    const head = label.slice(0, sep).trim();
    if (head) return head;
  }
  return label || catalog?.label || provider;
}

/**
 * If a stored credential label still looks like legacy "Company · Model",
 * return the cleaned company-only label; otherwise null.
 */
export function cleanedCompanyLabel(input: { label: string; provider?: string | null }): string | null {
  const label = input.label.trim();
  if (!label.includes(' · ')) return null;
  const next = companyDisplayName(input);
  return next && next !== label ? next : null;
}
