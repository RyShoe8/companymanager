'use client';

import { useEffect, useState } from 'react';

const DEFAULT_IDLE_MS = 3 * 60_000;

export type PageActivity = {
  /** Tab is visible in the foreground. */
  visible: boolean;
  /** No pointer/keyboard activity for idleMs while visible. */
  isIdle: boolean;
  /** Convenience: visible && !isIdle — safe for polls and wake word. */
  isActive: boolean;
};

/**
 * Tracks document visibility and user idle time so long-lived pages can
 * pause background work (polls, wake recognition) when the tab is hidden or idle.
 */
export function usePageActivity(idleMs: number = DEFAULT_IDLE_MS): PageActivity {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  );
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const markActive = () => {
      setIsIdle(false);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIsIdle(true), idleMs);
    };

    const onVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      setVisible(isVisible);
      if (isVisible) {
        markActive();
      } else {
        setIsIdle(true);
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
      }
    };

    const onUserActivity = () => {
      if (document.visibilityState !== 'visible') return;
      markActive();
    };

    onVisibility();
    markActive();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity);
    window.addEventListener('scroll', onUserActivity, { passive: true, capture: true });

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('scroll', onUserActivity, true);
    };
  }, [idleMs]);

  return {
    visible,
    isIdle: !visible || isIdle,
    isActive: visible && !isIdle,
  };
}
