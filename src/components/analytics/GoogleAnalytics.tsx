'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackGoogleAnalyticsPageView, updateGoogleAnalyticsConsent } from '@/lib/analytics/googleAnalytics';
import {
  hasAnalyticsConsent,
  onAnalyticsConsentChange,
} from '@/lib/analytics/cookieScriptConsent';

function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consentGranted = useRef(false);
  const pathnameRef = useRef(pathname ?? '/');
  const searchRef = useRef('');

  pathnameRef.current = pathname ?? '/';
  searchRef.current = searchParams?.toString() ?? '';

  useEffect(() => {
    const applyConsent = (granted: boolean) => {
      consentGranted.current = granted;
      updateGoogleAnalyticsConsent(granted);
      if (granted) {
        trackGoogleAnalyticsPageView(pathnameRef.current, searchRef.current);
      }
    };

    if (hasAnalyticsConsent()) {
      applyConsent(true);
    }

    return onAnalyticsConsentChange(applyConsent);
  }, []);

  useEffect(() => {
    if (!consentGranted.current) return;
    trackGoogleAnalyticsPageView(pathname ?? '/', searchParams?.toString() ?? '');
  }, [pathname, searchParams]);

  return null;
}

export default function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsPageViews />
    </Suspense>
  );
}
