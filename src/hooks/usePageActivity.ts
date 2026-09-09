'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  createPageActivityStore,
  DEFAULT_IDLE_MS,
  pageActivityStore,
  type PageActivity,
} from '@/lib/ui/pageActivityStore';

export type { PageActivity } from '@/lib/ui/pageActivityStore';

/** Default consumers share one visibility/idle listener set and one bounded timer. */
export function usePageActivity(idleMs: number = DEFAULT_IDLE_MS): PageActivity {
  const store = useMemo(
    () => idleMs === DEFAULT_IDLE_MS ? pageActivityStore : createPageActivityStore(idleMs),
    [idleMs]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
