'use client';

import { useCallback } from 'react';
import { getRecaptchaSiteKey } from '@/components/recaptcha/RecaptchaScript';
import type { RecaptchaAction } from '@/lib/recaptcha/actions';

export function useRecaptcha() {
  const executeRecaptcha = useCallback(async (action: RecaptchaAction): Promise<string | null> => {
    const siteKey = getRecaptchaSiteKey();
    if (!siteKey) return null;

    if (typeof window === 'undefined' || !window.grecaptcha) {
      throw new Error('reCAPTCHA is not loaded yet. Please try again.');
    }

    return new Promise((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window
          .grecaptcha!.execute(siteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  }, []);

  return { executeRecaptcha, isEnabled: Boolean(getRecaptchaSiteKey()) };
}
