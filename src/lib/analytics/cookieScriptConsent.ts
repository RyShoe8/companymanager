export type CookieScriptCategory =
  | 'strict'
  | 'performance'
  | 'targeting'
  | 'functionality'
  | 'unclassified';

/** Cookie-Script category used for analytics (GA, Ahrefs, PostHog). */
export const ANALYTICS_CONSENT_CATEGORY: CookieScriptCategory = 'performance';

type CookieScriptState = {
  action: 'accept' | 'reject';
  categories: CookieScriptCategory[];
};

type CookieScriptInstance = {
  currentState?: () => CookieScriptState;
};

declare global {
  interface Window {
    CookieScript?: {
      instance?: CookieScriptInstance;
    };
  }
}

export function getCookieScriptState(): CookieScriptState | null {
  if (typeof window === 'undefined') return null;
  return window.CookieScript?.instance?.currentState?.() ?? null;
}

export function hasAnalyticsConsent(): boolean {
  const state = getCookieScriptState();
  if (!state) return false;
  if (state.action === 'reject') return false;
  return state.categories.includes(ANALYTICS_CONSENT_CATEGORY);
}

const CONSENT_EVENTS = [
  'CookieScriptAccept',
  'CookieScriptAcceptAll',
  'CookieScriptCategory-performance',
  'CookieScriptCategory-all',
] as const;

/** Subscribe to Cookie-Script consent changes; returns unsubscribe. */
export function onAnalyticsConsentChange(callback: (granted: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const notify = () => callback(hasAnalyticsConsent());

  for (const eventName of CONSENT_EVENTS) {
    window.addEventListener(eventName, notify);
  }

  let readyInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
    if (window.CookieScript?.instance?.currentState) {
      if (readyInterval) clearInterval(readyInterval);
      readyInterval = null;
      notify();
    }
  }, 100);

  const readyTimeout = window.setTimeout(() => {
    if (readyInterval) clearInterval(readyInterval);
    readyInterval = null;
  }, 10_000);

  return () => {
    for (const eventName of CONSENT_EVENTS) {
      window.removeEventListener(eventName, notify);
    }
    if (readyInterval) clearInterval(readyInterval);
    window.clearTimeout(readyTimeout);
  };
}
