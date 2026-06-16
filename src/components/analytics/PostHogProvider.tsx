'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { getPostHogHost, getPostHogKey, isPostHogEnabled } from '@/lib/analytics/posthog';

type AuthMe = {
  id?: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  isOrgOwner?: boolean;
};

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPostHogEnabled()) return;
    let url = pathname ?? '/';
    const query = searchParams?.toString();
    if (query) url += `?${query}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function PostHogIdentify() {
  const pathname = usePathname();
  const lastIdentifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (!isPostHogEnabled()) return;

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
  }, [pathname]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !isPostHogEnabled()) return;

    const key = getPostHogKey();
    const host = getPostHogHost();
    if (!key || !host) return;

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
    });
    initialized.current = true;
  }, []);

  if (!isPostHogEnabled()) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
