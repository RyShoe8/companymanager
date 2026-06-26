import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureGoogleAnalytics,
  ensureGtag,
  trackGoogleAnalyticsPageView,
  updateGoogleAnalyticsConsent,
} from '@/lib/analytics/googleAnalytics';

describe('googleAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }).dataLayer;
    delete (window as { gtag?: (...args: unknown[]) => void }).gtag;
  });

  it('updates consent via gtag', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag, dataLayer: [] });

    updateGoogleAnalyticsConsent(true);

    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('configures GA without automatic page views', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag, dataLayer: [] });

    configureGoogleAnalytics('G-TEST');

    expect(gtag).toHaveBeenCalledWith('js', expect.any(Date));
    expect(gtag).toHaveBeenCalledWith('config', 'G-TEST', { send_page_view: false });
  });

  it('sends manual page_view events', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', {
      gtag,
      dataLayer: [],
      location: { origin: 'https://nucleas.app' },
    });

    ensureGtag();
    trackGoogleAnalyticsPageView('/pricing', 'ref=home', 'G-TEST');

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/pricing?ref=home',
      page_location: 'https://nucleas.app/pricing?ref=home',
      send_to: 'G-TEST',
    });
  });
});
