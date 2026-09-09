import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeEntrance } from './observeEntrance';

describe('observeEntrance', () => {
  let notify: IntersectionObserverCallback;
  const disconnect = vi.fn();
  const observe = vi.fn();
  const element = {} as Element;
  const entry = (isIntersecting: boolean) => ({ isIntersecting }) as IntersectionObserverEntry;
  const emit = (visible: boolean) => notify([entry(visible)], {} as IntersectionObserver);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('observes until visible, then disconnects and reveals only once', () => {
    const reveal = vi.fn();
    const cleanup = observeEntrance(element, reveal, 100);
    expect(observe).toHaveBeenCalledWith(element);
    emit(false);
    expect(vi.getTimerCount()).toBe(0);
    emit(true);
    emit(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(99);
    expect(reveal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reveal).toHaveBeenCalledTimes(1);
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels pending reveal and ignores queued callbacks after cleanup', () => {
    const reveal = vi.fn();
    const cleanup = observeEntrance(element, reveal, 100);
    emit(true);
    cleanup();
    emit(true);
    vi.runAllTimers();
    expect(reveal).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases an observer that never became visible', () => {
    const reveal = vi.fn();
    const cleanup = observeEntrance(element, reveal, 0);
    cleanup();
    emit(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(reveal).not.toHaveBeenCalled();
  });

  it('reveals without a timer when the browser lacks IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const reveal = vi.fn();
    observeEntrance(element, reveal, 100)();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
