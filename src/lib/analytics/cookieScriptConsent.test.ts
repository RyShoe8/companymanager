import { afterEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_CONSENT_CATEGORY,
  getCookieScriptState,
  hasAnalyticsConsent,
} from '@/lib/analytics/cookieScriptConsent';

describe('cookieScriptConsent', () => {
  afterEach(() => {
    delete (window as { CookieScript?: unknown }).CookieScript;
  });

  it('returns false when CookieScript is not initialized', () => {
    expect(hasAnalyticsConsent()).toBe(false);
    expect(getCookieScriptState()).toBeNull();
  });

  it('returns false when user rejected cookies', () => {
    window.CookieScript = {
      instance: {
        currentState: () => ({
          action: 'reject',
          categories: ['strict'],
        }),
      },
    };
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('returns true when performance category is accepted', () => {
    window.CookieScript = {
      instance: {
        currentState: () => ({
          action: 'accept',
          categories: ['strict', ANALYTICS_CONSENT_CATEGORY],
        }),
      },
    };
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('returns false when only non-analytics categories are accepted', () => {
    window.CookieScript = {
      instance: {
        currentState: () => ({
          action: 'accept',
          categories: ['strict', 'functionality'],
        }),
      },
    };
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
