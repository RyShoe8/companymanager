import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquirePageScrollLock, lockPageScroll, unlockPageScroll } from './scrollLock';

describe('page scroll locks', () => {
  let root: { overflow: string };
  let body: { overflow: string };
  beforeEach(() => {
    root = { overflow: 'auto' };
    body = { overflow: 'scroll' };
    vi.stubGlobal('document', { documentElement: { style: root }, body: { style: body } });
  });
  afterEach(() => {
    // Balance any locks even if an assertion failed.
    for (let i = 0; i < 5; i++) unlockPageScroll();
    vi.unstubAllGlobals();
  });

  it('keeps nested overlays locked until the last release and restores prior styles', () => {
    const releaseModal = acquirePageScrollLock();
    const releasePreview = acquirePageScrollLock();
    expect(root.overflow).toBe('hidden');
    expect(body.overflow).toBe('hidden');
    releaseModal();
    expect(body.overflow).toBe('hidden');
    releasePreview();
    expect(root.overflow).toBe('auto');
    expect(body.overflow).toBe('scroll');
  });

  it('does not let duplicate cleanup release a different overlay lock', () => {
    const releaseFirst = acquirePageScrollLock();
    const releaseSecond = acquirePageScrollLock();
    releaseFirst();
    releaseFirst();
    expect(body.overflow).toBe('hidden');
    releaseSecond();
    expect(body.overflow).toBe('scroll');
  });

  it('interoperates with existing modal locks', () => {
    lockPageScroll();
    const release = acquirePageScrollLock();
    release();
    expect(body.overflow).toBe('hidden');
    unlockPageScroll();
    expect(body.overflow).toBe('scroll');
  });

  it('ignores unmatched unlocks and snapshots fresh styles for the next cycle', () => {
    unlockPageScroll();
    expect(body.overflow).toBe('scroll');
    acquirePageScrollLock()();
    body.overflow = 'clip';
    acquirePageScrollLock()();
    expect(body.overflow).toBe('clip');
  });

  it('does nothing during server rendering', () => {
    vi.stubGlobal('document', undefined);
    expect(() => acquirePageScrollLock()()).not.toThrow();
  });
});
