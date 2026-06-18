import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha/actions';
import {
  getRecaptchaMinScore,
  isRecaptchaConfigured,
  verifyRecaptchaToken,
} from '@/lib/recaptcha/verifyRecaptcha';

describe('verifyRecaptcha', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('isRecaptchaConfigured reflects secret key presence', () => {
    expect(isRecaptchaConfigured()).toBe(true);
    delete process.env.RECAPTCHA_SECRET_KEY;
    expect(isRecaptchaConfigured()).toBe(false);
  });

  it('defaults min score to 0.5', () => {
    delete process.env.RECAPTCHA_MIN_SCORE;
    expect(getRecaptchaMinScore()).toBe(0.5);
  });

  it('skips verification in non-production when secret is unset', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = 'development';

    const result = await verifyRecaptchaToken({
      token: '',
      expectedAction: RECAPTCHA_ACTIONS.login,
    });

    expect(result).toEqual({ ok: true, score: 1 });
  });

  it('rejects in production when secret is unset', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = 'production';

    const result = await verifyRecaptchaToken({
      token: 'token',
      expectedAction: RECAPTCHA_ACTIONS.login,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Verification is unavailable. Please try again later.',
      status: 503,
    });
  });

  it('rejects missing token when configured', async () => {
    const result = await verifyRecaptchaToken({
      token: '',
      expectedAction: RECAPTCHA_ACTIONS.contactSubmit,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Verification failed. Please try again.',
      status: 403,
    });
  });

  it('accepts valid siteverify response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.9,
          action: RECAPTCHA_ACTIONS.register,
        }),
        { status: 200 }
      )
    );

    const result = await verifyRecaptchaToken({
      token: 'valid-token',
      expectedAction: RECAPTCHA_ACTIONS.register,
    });

    expect(result).toEqual({ ok: true, score: 0.9 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects wrong action', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.9,
          action: 'wrong_action',
        }),
        { status: 200 }
      )
    );

    const result = await verifyRecaptchaToken({
      token: 'valid-token',
      expectedAction: RECAPTCHA_ACTIONS.login,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it('rejects low score', async () => {
    process.env.RECAPTCHA_MIN_SCORE = '0.7';
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          score: 0.2,
          action: RECAPTCHA_ACTIONS.bookCall,
        }),
        { status: 200 }
      )
    );

    const result = await verifyRecaptchaToken({
      token: 'valid-token',
      expectedAction: RECAPTCHA_ACTIONS.bookCall,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it('rejects unsuccessful siteverify response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          'error-codes': ['invalid-input-response'],
        }),
        { status: 200 }
      )
    );

    const result = await verifyRecaptchaToken({
      token: 'bad-token',
      expectedAction: RECAPTCHA_ACTIONS.contactSubmit,
    });

    expect(result.ok).toBe(false);
  });
});
