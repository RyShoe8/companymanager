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

export function loadGoogleAnalyticsScript(measurementId = GA_MEASUREMENT_ID): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`
  );
  if (existing) {
    if (existing.getAttribute('data-loaded') === 'true') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('gtag load failed')), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error('gtag load failed'));
    document.head.appendChild(script);
  });
}

export function configureGoogleAnalytics(measurementId = GA_MEASUREMENT_ID): void {
  ensureGtag();
  window.gtag!('js', new Date());
  window.gtag!('config', measurementId, { send_page_view: false });
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
