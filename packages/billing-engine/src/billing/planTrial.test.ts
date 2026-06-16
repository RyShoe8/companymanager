import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  checkoutTrialPeriodDays,
  getPlanTrialDays,
  isCheckoutSessionPaymentComplete,
} from './planTrial';

describe('getPlanTrialDays', () => {
  it('returns 0 for lifetime plans', () => {
    expect(getPlanTrialDays({ trialDays: 14, interval: 'lifetime' })).toBe(0);
  });

  it('clamps trial days to 365', () => {
    expect(getPlanTrialDays({ trialDays: 500, interval: 'month' })).toBe(365);
  });

  it('returns configured days for monthly plans', () => {
    expect(getPlanTrialDays({ trialDays: 14, interval: 'month' })).toBe(14);
  });

  it('returns 0 when trialDays is 0 or missing', () => {
    expect(getPlanTrialDays({ trialDays: 0, interval: 'year' })).toBe(0);
    expect(getPlanTrialDays({ interval: 'year' } as { trialDays?: number; interval: 'year' })).toBe(0);
  });
});

describe('checkoutTrialPeriodDays', () => {
  it('returns undefined when no trial', () => {
    expect(checkoutTrialPeriodDays({ trialDays: 0, interval: 'month' })).toBeUndefined();
  });

  it('returns days when trial configured', () => {
    expect(checkoutTrialPeriodDays({ trialDays: 7, interval: 'month' })).toBe(7);
  });
});

describe('isCheckoutSessionPaymentComplete', () => {
  it('accepts paid sessions', () => {
    expect(isCheckoutSessionPaymentComplete({ mode: 'subscription', payment_status: 'paid' })).toBe(true);
  });

  it('accepts no_payment_required for subscription trials', () => {
    expect(
      isCheckoutSessionPaymentComplete({ mode: 'subscription', payment_status: 'no_payment_required' })
    ).toBe(true);
  });

  it('rejects unpaid subscription sessions', () => {
    expect(isCheckoutSessionPaymentComplete({ mode: 'subscription', payment_status: 'unpaid' })).toBe(
      false
    );
  });
});

describe('shouldApplyPlanTrialAtCheckout', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false when trialDays is 0', async () => {
    const { shouldApplyPlanTrialAtCheckout } = await import('./planTrial');
    const result = await shouldApplyPlanTrialAtCheckout('507f1f77bcf86cd799439011', {
      trialDays: 0,
      interval: 'month',
    });
    expect(result).toBe(false);
  });
});
