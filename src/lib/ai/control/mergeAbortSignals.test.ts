import { describe, expect, it } from 'vitest';
import { mergeAbortSignals } from '@/lib/ai/control/mergeAbortSignals';

describe('mergeAbortSignals', () => {
  it('returns a single signal unchanged', () => {
    const controller = new AbortController();
    expect(mergeAbortSignals(controller.signal)).toBe(controller.signal);
  });

  it('aborts when either source aborts', () => {
    const a = new AbortController();
    const b = new AbortController();
    const merged = mergeAbortSignals(a.signal, b.signal);
    expect(merged.aborted).toBe(false);
    b.abort();
    expect(merged.aborted).toBe(true);
  });

  it('starts aborted if a source is already aborted', () => {
    const a = new AbortController();
    a.abort();
    const b = new AbortController();
    expect(mergeAbortSignals(a.signal, b.signal).aborted).toBe(true);
  });

  it('models NDJSON stream cancel wiring request + stream abort', () => {
    const request = new AbortController();
    const streamAbort = new AbortController();
    const chatSignal = mergeAbortSignals(request.signal, streamAbort.signal);
    // ReadableStream.cancel → streamAbort.abort()
    streamAbort.abort();
    expect(chatSignal.aborted).toBe(true);
  });
});
