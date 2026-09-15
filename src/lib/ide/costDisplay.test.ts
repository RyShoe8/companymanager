import { describe, expect, it } from 'vitest';
import { formatIdeCostUsd } from '@/lib/ide/costDisplay';
import { employeeForIdeMode, isIdeChatMode } from '@/lib/ide/modes';

describe('ide modes', () => {
  it('uses AI Team employee ids as worker modes', () => {
    expect(employeeForIdeMode('product')).toBe('product');
    expect(employeeForIdeMode('engineering')).toBe('engineering');
    expect(employeeForIdeMode('researcher')).toBe('researcher');
    expect(employeeForIdeMode('marketing')).toBe('marketing');
    expect(employeeForIdeMode('support')).toBe('support');
    expect(isIdeChatMode('engineering')).toBe(true);
    expect(isIdeChatMode('support')).toBe(true);
    expect(isIdeChatMode('build')).toBe(false);
  });
});

describe('formatIdeCostUsd', () => {
  it('shows zero with no-provider-fee cue', () => {
    expect(formatIdeCostUsd({ costMicros: null, reservedMicros: 25, noProviderFee: true })).toEqual({
      label: 'no provider fee',
      amount: '$0.00',
    });
  });

  it('prefers token-estimated cost', () => {
    expect(formatIdeCostUsd({ costMicros: 1_500_000, reservedMicros: 2_000_000, noProviderFee: false })).toEqual({
      label: 'estimated',
      amount: '~$1.5',
    });
  });

  it('falls back to budget hold when settled unknown', () => {
    expect(formatIdeCostUsd({ costMicros: null, reservedMicros: 250_000, noProviderFee: false })).toEqual({
      label: 'budget hold',
      amount: '$0.25',
    });
  });
});
