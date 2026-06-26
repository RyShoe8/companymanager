'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  configureGoogleAnalytics,
  loadGoogleAnalyticsScript,
  trackGoogleAnalyticsPageView,
  updateGoogleAnalyticsConsent,
} from '@/lib/analytics/googleAnalytics';
import { onAnalyticsConsentChange } from '@/lib/analytics/cookieScriptConsent';

function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ready = useRef(false);
  const pathnameRef = useRef(pathname ?? '/');
  const searchRef = useRef('');

  pathnameRef.current = pathname ?? '/';
  searchRef.current = searchParams?.toString() ?? '';

  useEffect(() => {
    return onAnalyticsConsentChange((granted) => {
      updateGoogleAnalyticsConsent(granted);
      if (!granted) {
        ready.current = false;
        return;
      }

      void (async () => {
        try {
          if (!ready.current) {
            await loadGoogleAnalyticsScript();
            configureGoogleAnalytics();
            ready.current = true;
          }
          trackGoogleAnalyticsPageView(pathnameRef.current, searchRef.current);
        } catch {
          // Ignore analytics load failures
        }
      })();
    });
  }, []);

  useEffect(() => {
    if (!ready.current) return;
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
