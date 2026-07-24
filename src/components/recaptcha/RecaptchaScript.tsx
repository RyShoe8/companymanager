'use client';

import Script from 'next/script';

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

export const RECAPTCHA_LOADED_EVENT = 'nucleas-recaptcha-loaded';
export const RECAPTCHA_FAILED_EVENT = 'nucleas-recaptcha-failed';

export const RECAPTCHA_LOAD_ERROR_MESSAGE =
  'Security check failed to load. Refresh the page or disable blockers.';

export default function RecaptchaScript() {
  if (!siteKey) return null;

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(RECAPTCHA_LOADED_EVENT));
        }
      }}
      onError={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(RECAPTCHA_FAILED_EVENT));
        }
      }}
    />
  );
}

export function getRecaptchaSiteKey(): string | undefined {
  return siteKey;
}
