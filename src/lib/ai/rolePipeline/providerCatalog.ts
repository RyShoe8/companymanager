/** Catalog of OpenAI-compatible chat providers for the Admin model registry. */

export type ModelProviderId =
  | 'openai'
  | 'anthropic'
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
 */
export const MODEL_PROVIDERS: ModelProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your OpenAI API key (sk-…).',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (via OpenRouter)',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Claude through OpenRouter’s OpenAI-compatible API. Use an OpenRouter API key (not a raw Anthropic key) until native Anthropic support ships.',
    models: [
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your Groq API key.',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8×7B' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your DeepSeek API key.',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    defaultTier: 'commercial',
    hint: 'Paste your Together API key.',
    models: [
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
      { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', label: 'Llama 3.1 70B' },
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
      { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
      { id: 'google/gemini-2.0-flash-001', label: 'Google Gemini 2.0 Flash' },
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

export function defaultLabelFor(providerLabel: string, modelLabel: string): string {
  return `${providerLabel} · ${modelLabel}`.slice(0, 120);
}
