/**
 * Provider prepaid / key-cap balance adapters.
 * Fail closed: never throw provider bodies or secrets.
 */

import { dollarsToMicros } from '@/lib/ai/settingsSchema';

export type ProviderBalanceKind = 'unlimited' | 'live' | 'manual' | 'unsupported';

export type ProviderBalanceResult = {
  kind: ProviderBalanceKind;
  /** Remaining micro-USD when kind is live or manual. */
  remainingMicros: number | null;
  /** Human source label for UI (e.g. live · deepseek). */
  source: string;
  error: string | null;
};

export function mapDeepSeekBalanceResponse(body: unknown): ProviderBalanceResult {
  if (!body || typeof body !== 'object') {
    return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Unable to read DeepSeek balance.' };
  }
  const infos = (body as { balance_infos?: unknown }).balance_infos;
  if (!Array.isArray(infos) || infos.length === 0) {
    const total = (body as { total_balance?: unknown }).total_balance;
    if (typeof total === 'string' || typeof total === 'number') {
      const micros = parseBalanceNumber(total);
      if (micros == null) {
        return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Unable to parse DeepSeek balance.' };
      }
      return { kind: 'live', remainingMicros: micros, source: 'live · deepseek', error: null };
    }
    return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'DeepSeek returned no balance info.' };
  }
  const usd = infos.find(
    (item) => item && typeof item === 'object' && String((item as { currency?: unknown }).currency).toUpperCase() === 'USD'
  );
  const pick = usd ?? infos[0];
  if (!pick || typeof pick !== 'object') {
    return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Unable to read DeepSeek balance.' };
  }
  const total = (pick as { total_balance?: unknown }).total_balance;
  const micros = parseBalanceNumber(total);
  if (micros == null) {
    return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Unable to parse DeepSeek balance.' };
  }
  const currency = String((pick as { currency?: unknown }).currency ?? 'USD').toUpperCase();
  return {
    kind: 'live',
    remainingMicros: micros,
    source: currency === 'USD' ? 'live · deepseek' : `live · deepseek (${currency})`,
    error: null,
  };
}

export function mapOpenRouterKeyResponse(body: unknown): ProviderBalanceResult {
  if (!body || typeof body !== 'object') {
    return { kind: 'live', remainingMicros: null, source: 'live · openrouter', error: 'Unable to read OpenRouter key balance.' };
  }
  const data = (body as { data?: unknown }).data;
  const root = data && typeof data === 'object' ? data : body;
  const remaining = (root as { limit_remaining?: unknown }).limit_remaining;
  if (remaining == null) {
    return {
      kind: 'live',
      remainingMicros: null,
      source: 'live · openrouter',
      error: 'OpenRouter key has no spend cap remaining to report.',
    };
  }
  const micros = parseBalanceNumber(remaining);
  if (micros == null) {
    return { kind: 'live', remainingMicros: null, source: 'live · openrouter', error: 'Unable to parse OpenRouter remaining.' };
  }
  return { kind: 'live', remainingMicros: micros, source: 'live · openrouter', error: null };
}

function parseBalanceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    try {
      return dollarsToMicros(value.toFixed(6).replace(/\.?0+$/, '') || '0');
    } catch {
      return Math.min(Number.MAX_SAFE_INTEGER, Math.round(value * 1_000_000));
    }
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return dollarsToMicros(value.trim());
    } catch {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return null;
      return Math.min(Number.MAX_SAFE_INTEGER, Math.round(n * 1_000_000));
    }
  }
  return null;
}

export function resolveStaticProviderBalance(input: {
  provider: string;
  manualBalanceMicros?: number | null;
}): ProviderBalanceResult {
  const provider = input.provider || 'custom';
  if (provider === 'custom') {
    return { kind: 'unlimited', remainingMicros: null, source: 'unlimited', error: null };
  }
  if (provider === 'deepseek' || provider === 'openrouter') {
    // Live path handled by fetch helpers; static resolve is unused for these.
    return { kind: 'live', remainingMicros: null, source: `live · ${provider}`, error: 'Balance not loaded.' };
  }
  if (input.manualBalanceMicros != null && Number.isFinite(input.manualBalanceMicros)) {
    return {
      kind: 'manual',
      remainingMicros: Math.max(0, Math.floor(input.manualBalanceMicros)),
      source: 'manual',
      error: null,
    };
  }
  return {
    kind: 'unsupported',
    remainingMicros: null,
    source: 'unsupported',
    error: 'This provider does not expose remaining balance via API key. Enter an available amount.',
  };
}

async function readJsonBounded(
  response: Response,
  maxBytes = 64_000
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Remote authentication was rejected while reading balance.' };
    }
    return { ok: false, error: 'Unable to read balance from the provider.' };
  }
  const reader = response.body?.getReader();
  if (!reader) return { ok: false, error: 'Unable to read balance from the provider.' };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, error: 'Balance response was too large.' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, error: 'Balance response was not valid JSON.' };
  }
}

export async function fetchDeepSeekBalance(input: {
  bearerToken: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<ProviderBalanceResult> {
  const token = input.bearerToken.trim();
  if (!token || /[\r\n]/.test(token)) {
    return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Credential is missing or invalid.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(controller.abort.bind(controller), input.timeoutMs ?? 8000);
  try {
    const response = await (input.fetcher ?? fetch)('https://api.deepseek.com/user/balance', {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const parsed = await readJsonBounded(response);
    if (!parsed.ok) {
      return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: parsed.error };
    }
    return mapDeepSeekBalanceResponse(parsed.body);
  } catch {
    return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Unable to reach DeepSeek for balance.' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchOpenRouterBalance(input: {
  bearerToken: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<ProviderBalanceResult> {
  const token = input.bearerToken.trim();
  if (!token || /[\r\n]/.test(token)) {
    return { kind: 'live', remainingMicros: null, source: 'live · openrouter', error: 'Credential is missing or invalid.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(controller.abort.bind(controller), input.timeoutMs ?? 8000);
  try {
    const response = await (input.fetcher ?? fetch)('https://openrouter.ai/api/v1/key', {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const parsed = await readJsonBounded(response);
    if (!parsed.ok) {
      return { kind: 'live', remainingMicros: null, source: 'live · openrouter', error: parsed.error };
    }
    return mapOpenRouterKeyResponse(parsed.body);
  } catch {
    return {
      kind: 'live',
      remainingMicros: null,
      source: 'live · openrouter',
      error: 'Unable to reach OpenRouter for balance.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveProviderBalance(input: {
  provider: string;
  bearerToken?: string;
  manualBalanceMicros?: number | null;
  fetcher?: typeof fetch;
}): Promise<ProviderBalanceResult> {
  const provider = input.provider || 'custom';
  if (provider === 'custom') return resolveStaticProviderBalance({ provider });
  if (provider === 'deepseek') {
    if (!input.bearerToken) {
      return { kind: 'live', remainingMicros: null, source: 'live · deepseek', error: 'Credential is missing or invalid.' };
    }
    return fetchDeepSeekBalance({ bearerToken: input.bearerToken, fetcher: input.fetcher });
  }
  if (provider === 'openrouter') {
    if (!input.bearerToken) {
      return { kind: 'live', remainingMicros: null, source: 'live · openrouter', error: 'Credential is missing or invalid.' };
    }
    return fetchOpenRouterBalance({ bearerToken: input.bearerToken, fetcher: input.fetcher });
  }
  return resolveStaticProviderBalance({
    provider,
    manualBalanceMicros: input.manualBalanceMicros,
  });
}

type CacheEntry = { expiresAt: number; result: ProviderBalanceResult };
const balanceCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export function getCachedProviderBalance(profileId: string): ProviderBalanceResult | null {
  const hit = balanceCache.get(profileId);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    balanceCache.delete(profileId);
    return null;
  }
  return hit.result;
}

export function setCachedProviderBalance(profileId: string, result: ProviderBalanceResult): void {
  balanceCache.set(profileId, { expiresAt: Date.now() + CACHE_TTL_MS, result });
}

export function clearProviderBalanceCache(profileId?: string): void {
  if (profileId) balanceCache.delete(profileId);
  else balanceCache.clear();
}

export function formatBalanceHint(result: ProviderBalanceResult, microsToDollars: (n: number) => string): string {
  if (result.kind === 'unlimited') return 'Unlimited';
  if (result.remainingMicros != null) return `$${microsToDollars(result.remainingMicros)}`;
  if (result.kind === 'unsupported') return '—';
  return '—';
}
