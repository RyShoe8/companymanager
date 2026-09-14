import { describe, expect, it } from 'vitest';
import {
  formatBalanceHint,
  mapDeepSeekBalanceResponse,
  mapOpenRouterKeyResponse,
  resolveStaticProviderBalance,
} from '@/lib/ai/rolePipeline/providerBalance';
import { microsToDollars, platformAiSettingsSchema, defaultPlatformAiSettings } from '@/lib/ai/settingsSchema';

describe('providerBalance adapters', () => {
  it('maps DeepSeek balance_infos USD total', () => {
    const result = mapDeepSeekBalanceResponse({
      balance_infos: [
        { currency: 'CNY', total_balance: '50.00' },
        { currency: 'USD', total_balance: '12.5' },
      ],
    });
    expect(result.kind).toBe('live');
    expect(result.remainingMicros).toBe(12_500_000);
    expect(result.error).toBeNull();
  });

  it('maps OpenRouter limit_remaining', () => {
    const result = mapOpenRouterKeyResponse({ data: { limit_remaining: 3.25 } });
    expect(result.kind).toBe('live');
    expect(result.remainingMicros).toBe(3_250_000);
  });

  it('treats custom as unlimited', () => {
    expect(resolveStaticProviderBalance({ provider: 'custom' })).toMatchObject({
      kind: 'unlimited',
      remainingMicros: null,
    });
  });

  it('uses manual balance for unsupported providers', () => {
    expect(
      resolveStaticProviderBalance({ provider: 'openai', manualBalanceMicros: 1_000_000 })
    ).toMatchObject({ kind: 'manual', remainingMicros: 1_000_000 });
    expect(resolveStaticProviderBalance({ provider: 'openai' }).kind).toBe('unsupported');
  });

  it('formats balance hints', () => {
    expect(formatBalanceHint({ kind: 'unlimited', remainingMicros: null, source: 'unlimited', error: null }, microsToDollars)).toBe(
      'Unlimited'
    );
    expect(
      formatBalanceHint(
        { kind: 'live', remainingMicros: 2_000_000, source: 'live', error: null },
        microsToDollars
      )
    ).toBe('$2');
  });
});

describe('free pool validation', () => {
  it('accepts non-negative free pool fields with defaults', () => {
    const parsed = platformAiSettingsSchema.parse({
      ...defaultPlatformAiSettings,
      freePoolLimitMicros: 5_000_000,
      freePoolRemainingMicros: 2_000_000,
    });
    expect(parsed.freePoolRemainingMicros).toBe(2_000_000);
  });

  it('rejects remaining above a positive limit', () => {
    expect(
      platformAiSettingsSchema.safeParse({
        ...defaultPlatformAiSettings,
        freePoolLimitMicros: 1_000_000,
        freePoolRemainingMicros: 2_000_000,
      }).success
    ).toBe(false);
  });

  it('defaults missing free pool fields on legacy settings', () => {
    const { freePoolLimitMicros, freePoolRemainingMicros, ...legacy } = defaultPlatformAiSettings;
    void freePoolLimitMicros;
    void freePoolRemainingMicros;
    const parsed = platformAiSettingsSchema.parse(legacy);
    expect(parsed.freePoolLimitMicros).toBe(0);
    expect(parsed.freePoolRemainingMicros).toBe(0);
  });
});
