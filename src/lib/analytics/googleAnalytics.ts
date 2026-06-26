import { GA_MEASUREMENT_ID } from '@/lib/analytics/analyticsConfig';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function ensureGtag(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer!.push(args);
    };
  }
}

export function updateGoogleAnalyticsConsent(granted: boolean): void {
  ensureGtag();
  window.gtag!('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function trackGoogleAnalyticsPageView(
  path: string,
  search = '',
  measurementId = GA_MEASUREMENT_ID
): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  const pagePath = search ? `${path}?${search}` : path;
  const pageLocation = `${window.location.origin}${pagePath}`;
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_location: pageLocation,
    send_to: measurementId,
  });
}
