'use client';

import Script from 'next/script';

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

export default function RecaptchaScript() {
  if (!siteKey) return null;

  return (
    <Script
      src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
      strategy="afterInteractive"
    />
  );
}

export function getRecaptchaSiteKey(): string | undefined {
  return siteKey;
}
