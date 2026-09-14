import { describe, expect, it } from 'vitest';
import { formatIdeCostUsd } from '@/lib/ide/costDisplay';
import { employeeForIdeMode, isIdeChatMode } from '@/lib/ide/modes';

describe('ide modes', () => {
  it('maps modes to employees', () => {
    expect(employeeForIdeMode('plan')).toBe('product');
    expect(employeeForIdeMode('build')).toBe('engineering');
    expect(employeeForIdeMode('research')).toBe('researcher');
    expect(employeeForIdeMode('marketing')).toBe('marketing');
    expect(isIdeChatMode('build')).toBe(true);
    expect(isIdeChatMode('support')).toBe(false);
  });
});

describe('formatIdeCostUsd', () => {
  it('shows zero with no-provider-fee cue', () => {
    expect(formatIdeCostUsd({ costMicros: null, reservedMicros: 25, noProviderFee: true })).toEqual({
      label: 'no provider fee',
      amount: '$0.00',
    });
  });

  it('prefers settled cost', () => {
    expect(formatIdeCostUsd({ costMicros: 1_500_000, reservedMicros: 2_000_000, noProviderFee: false })).toEqual({
      label: 'cost',
      amount: '$1.5',
    });
  });

  it('falls back to reserved when settled unknown', () => {
    expect(formatIdeCostUsd({ costMicros: null, reservedMicros: 250_000, noProviderFee: false })).toEqual({
      label: 'reserved',
      amount: '$0.25',
    });
  });
});
