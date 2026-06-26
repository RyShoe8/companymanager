import Script from 'next/script';
import {
  AHREFS_ANALYTICS_KEY,
  COOKIE_SCRIPT_SRC,
  GA_MEASUREMENT_ID,
} from '@/lib/analytics/analyticsConfig';
import { ANALYTICS_CONSENT_CATEGORY } from '@/lib/analytics/cookieScriptConsent';

/**
 * Cookie-Script CMP + Advanced Consent Mode defaults + always-on gtag loader.
 * Pageviews after performance consent are handled in GoogleAnalytics.tsx.
 */
export default function AnalyticsScripts() {
  return (
    <>
      <Script id="google-consent-defaults" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            functionality_storage: 'denied',
            personalization_storage: 'denied',
            security_storage: 'granted',
            wait_for_update: 500
          });
        `}
      </Script>

      <Script
        id="cookie-script-cmp"
        src={COOKIE_SCRIPT_SRC}
        strategy="beforeInteractive"
      />

      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-tag-config" strategy="afterInteractive">
        {`
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>

      <script
        type="text/plain"
        data-cookiescript="accepted"
        data-cookiecategory={ANALYTICS_CONSENT_CATEGORY}
        data-src="https://analytics.ahrefs.com/analytics.js"
        data-key={AHREFS_ANALYTICS_KEY}
      />
    </>
  );
}
