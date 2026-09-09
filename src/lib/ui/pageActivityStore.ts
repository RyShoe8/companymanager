export type PageActivity = { visible: boolean; isIdle: boolean; isActive: boolean };
export const DEFAULT_IDLE_MS = 3 * 60_000;
const serverSnapshot: PageActivity = { visible: true, isIdle: false, isActive: true };

/** One timer/listener set per store, active only while a view is subscribed. */
export function createPageActivityStore(idleMs = DEFAULT_IDLE_MS) {
  const timeout = Number.isFinite(idleMs) ? Math.max(0, idleMs) : DEFAULT_IDLE_MS;
  const listeners = new Set<() => void>();
  let snapshot = serverSnapshot;
  let cleanup: (() => void) | undefined;
  const publish = (visible: boolean, isIdle: boolean) => {
    if (snapshot.visible === visible && snapshot.isIdle === isIdle) return;
    snapshot = { visible, isIdle, isActive: visible && !isIdle };
    listeners.forEach((listener) => listener());
  };
  const start = () => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastActivity = Date.now();
    const clearTimer = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const checkIdle = () => {
      timer = undefined;
      if (disposed || document.visibilityState !== 'visible') return;
      const remaining = timeout - (Date.now() - lastActivity);
      if (remaining > 0) timer = setTimeout(checkIdle, remaining);
      else publish(true, true);
    };
    const markActive = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      lastActivity = Date.now();
      publish(true, false);
      // Input extends the deadline without allocating a timer for every event.
      if (timer === undefined) timer = setTimeout(checkIdle, timeout);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') markActive();
      else { clearTimer(); publish(false, true); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', markActive, { passive: true });
    window.addEventListener('keydown', markActive);
    window.addEventListener('scroll', markActive, { passive: true, capture: true });
    onVisibility();
    return () => {
      disposed = true;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('scroll', markActive, true);
    };
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      const notify = () => listener();
      listeners.add(notify);
      if (listeners.size === 1) cleanup = start();
      return () => {
        listeners.delete(notify);
        if (listeners.size === 0) { cleanup?.(); cleanup = undefined; }
      };
    },
  };
}

export const pageActivityStore = createPageActivityStore();
