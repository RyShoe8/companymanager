'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { getPostHogHost, getPostHogKey, isPostHogEnabled } from '@/lib/analytics/posthog';
import {
  hasAnalyticsConsent,
  onAnalyticsConsentChange,
} from '@/lib/analytics/cookieScriptConsent';

type AuthMe = {
  id?: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  isOrgOwner?: boolean;
};

function PostHogPageView({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled || !isPostHogEnabled()) return;
    let url = pathname ?? '/';
    const query = searchParams?.toString();
    if (query) url += `?${query}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [enabled, pathname, searchParams]);

  return null;
}

function PostHogIdentify({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const lastIdentifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !isPostHogEnabled()) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok || cancelled) return;

        const data = (await response.json()) as AuthMe | null;
        if (!data?.id) {
          if (lastIdentifiedId.current) {
            posthog.reset();
            lastIdentifiedId.current = null;
          }
          return;
        }

        if (lastIdentifiedId.current === data.id) return;

        posthog.identify(data.id, {
          email: data.email,
          name: data.name,
          is_admin: data.isAdmin ?? false,
          is_org_owner: data.isOrgOwner ?? false,
        });
        lastIdentifiedId.current = data.id;
      } catch {
        // Ignore analytics errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    return onAnalyticsConsentChange(setAnalyticsAllowed);
  }, []);

  useEffect(() => {
    if (!isPostHogEnabled()) return;

    if (!analyticsAllowed) {
      if (initialized.current) {
        posthog.opt_out_capturing();
        posthog.reset();
        initialized.current = false;
      }
      return;
    }

    if (initialized.current) {
      posthog.opt_in_capturing();
      return;
    }

    const key = getPostHogKey();
    const host = getPostHogHost();
    if (!key || !host) return;

    if (!hasAnalyticsConsent()) return;

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
    });
    posthog.opt_in_capturing();
    initialized.current = true;
  }, [analyticsAllowed]);

  if (!isPostHogEnabled() || !analyticsAllowed) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView enabled={analyticsAllowed} />
      </Suspense>
      <PostHogIdentify enabled={analyticsAllowed} />
      {children}
    </PHProvider>
  );
}
