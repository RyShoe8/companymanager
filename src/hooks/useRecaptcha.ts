'use client';

import { useCallback, useEffect, useState } from 'react';
import { getRecaptchaSiteKey, RECAPTCHA_LOADED_EVENT } from '@/components/recaptcha/RecaptchaScript';
import type { RecaptchaAction } from '@/lib/recaptcha/actions';

const RECAPTCHA_WAIT_MS = 10_000;
const RECAPTCHA_POLL_MS = 100;

function grecaptchaReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.grecaptcha);
}

export function isRecaptchaReady(): boolean {
  if (!getRecaptchaSiteKey()) return true;
  return grecaptchaReady();
}

function waitForGrecaptcha(timeoutMs = RECAPTCHA_WAIT_MS): Promise<void> {
  if (grecaptchaReady()) return Promise.resolve();
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Security check is still loading. Wait a moment and try again.')
    );
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();

    const onLoaded = () => {
      cleanup();
      if (grecaptchaReady()) resolve();
      else reject(new Error('Security check is still loading. Wait a moment and try again.'));
    };

    const poll = () => {
      if (grecaptchaReady()) {
        cleanup();
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        cleanup();
        reject(new Error('Security check is still loading. Wait a moment and try again.'));
        return;
      }
      timer = window.setTimeout(poll, RECAPTCHA_POLL_MS);
    };

    const cleanup = () => {
      window.removeEventListener(RECAPTCHA_LOADED_EVENT, onLoaded);
      if (timer != null) window.clearTimeout(timer);
    };

    let timer: number | undefined = window.setTimeout(poll, RECAPTCHA_POLL_MS);
    window.addEventListener(RECAPTCHA_LOADED_EVENT, onLoaded);
  });
}

export function useRecaptcha() {
  const isEnabled = Boolean(getRecaptchaSiteKey());
  const [ready, setReady] = useState(() => isRecaptchaReady());

  useEffect(() => {
    if (!isEnabled) {
      setReady(true);
      return;
    }
    if (grecaptchaReady()) {
      setReady(true);
      return;
    }
    const onLoaded = () => setReady(true);
    window.addEventListener(RECAPTCHA_LOADED_EVENT, onLoaded);
    const timer = window.setInterval(() => {
      if (grecaptchaReady()) {
        setReady(true);
        window.clearInterval(timer);
      }
    }, RECAPTCHA_POLL_MS);
    return () => {
      window.removeEventListener(RECAPTCHA_LOADED_EVENT, onLoaded);
      window.clearInterval(timer);
    };
  }, [isEnabled]);

  const executeRecaptcha = useCallback(async (action: RecaptchaAction): Promise<string | null> => {
    const siteKey = getRecaptchaSiteKey();
    if (!siteKey) return null;

    await waitForGrecaptcha();

    return new Promise((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window
          .grecaptcha!.execute(siteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  }, []);

  return { executeRecaptcha, isEnabled, ready };
}
