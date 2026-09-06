'use client';

import { useCallback, useEffect, useState } from 'react';

/** Explicit navigation/refresh only: one bounded snapshot, no polling or accumulating cache. */
export function useAiSnapshot<T>(url: string) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ url: string; version: number; data: T | null; error: string }>({ url: '', version: -1, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load AI history.');
      if (!controller.signal.aborted) setState({ url, version, data: body, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ url, version, data: null, error: error instanceof Error ? error.message : 'Unable to load AI history.' });
    });
    return () => controller.abort();
  }, [url, version]);
  const ready = state.url === url && state.version === version;
  const refresh = useCallback(() => setVersion(current => current + 1), []);
  return { data: ready ? state.data : null, error: ready ? state.error : '', loading: !ready, refresh };
}
