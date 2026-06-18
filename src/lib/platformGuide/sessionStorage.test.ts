import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  clearGuideStepIndex,
  readGuideStepIndex,
  writeGuideStepIndex,
} from '@/lib/platformGuide/sessionStorage';

describe('platform guide sessionStorage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists and reads step index', () => {
    expect(readGuideStepIndex()).toBeNull();
    writeGuideStepIndex(3);
    expect(readGuideStepIndex()).toBe(3);
  });

  it('clears stored index', () => {
    writeGuideStepIndex(1);
    clearGuideStepIndex();
    expect(readGuideStepIndex()).toBeNull();
  });
});
