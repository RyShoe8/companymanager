import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageActivityStore } from './pageActivityStore';

describe('pageActivityStore', () => {
  let doc: EventTarget & { visibilityState: string };
  let win: EventTarget;
  let releases: Array<() => void>;
  beforeEach(() => {
    vi.useFakeTimers();
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    win = new EventTarget();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    releases = [];
  });
  afterEach(() => {
    releases.forEach((release) => release());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const visibility = (state: string) => {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event('visibilitychange'));
  };

  it('shares one timer and listener set until the final subscriber leaves', () => {
    const add = vi.spyOn(win, 'addEventListener');
    const remove = vi.spyOn(win, 'removeEventListener');
    const store = createPageActivityStore(1000);
    releases.push(store.subscribe(vi.fn()), store.subscribe(vi.fn()));
    expect(add).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
    releases[0]();
    expect(vi.getTimerCount()).toBe(1);
    releases[1]();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledTimes(3);
    win.dispatchEvent(new Event('pointerdown'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('creates no timers while initially hidden and pauses again when hidden', () => {
    visibility('hidden');
    const store = createPageActivityStore(1000);
    releases.push(store.subscribe(vi.fn()));
    expect(store.getSnapshot()).toEqual({ visible: false, isIdle: true, isActive: false });
    expect(vi.getTimerCount()).toBe(0);
    win.dispatchEvent(new Event('scroll'));
    expect(vi.getTimerCount()).toBe(0);
    visibility('visible');
    expect(store.getSnapshot().isActive).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    visibility('hidden');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('extends idle deadlines without scheduling a timer or notifying on every input', () => {
    const store = createPageActivityStore(1000);
    const notify = vi.fn();
    releases.push(store.subscribe(notify));
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const initial = store.getSnapshot();
    vi.advanceTimersByTime(500);
    for (let i = 0; i < 100; i++) win.dispatchEvent(new Event('scroll'));
    expect(schedule).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(initial);
    expect(notify).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(store.getSnapshot().isIdle).toBe(false);
    vi.advanceTimersByTime(500);
    expect(store.getSnapshot().isIdle).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    win.dispatchEvent(new Event('keydown'));
    expect(store.getSnapshot().isActive).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('resynchronizes after unmount and remount without retaining background work', () => {
    const store = createPageActivityStore(1000);
    const release = store.subscribe(vi.fn());
    releases.push(release);
    release();
    visibility('hidden');
    releases.push(store.subscribe(vi.fn()));
    expect(store.getSnapshot().visible).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not register browser work on the server', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('window', undefined);
    const store = createPageActivityStore();
    releases.push(store.subscribe(vi.fn()));
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot().isActive).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
