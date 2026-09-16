/** Combine request disconnect + stream cancel into one AbortSignal. */
export function mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const defined = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (defined.length === 0) {
    return new AbortController().signal;
  }
  if (defined.length === 1) {
    return defined[0]!;
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(defined);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of defined) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}
