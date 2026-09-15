import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readStoredIdeChatMode,
  readStoredIdeDirectSelection,
  writeStoredIdeChatMode,
  writeStoredIdeDirectSelection,
} from '@/lib/ide/chatSelectionStorage';

const store = new Map<string, string>();

afterEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

function stubStorage() {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
}

describe('chatSelectionStorage', () => {
  it('persists and restores mode per project', () => {
    stubStorage();
    writeStoredIdeChatMode('proj-a', 'direct');
    writeStoredIdeChatMode('proj-b', 'product');
    expect(readStoredIdeChatMode('proj-a')).toBe('direct');
    expect(readStoredIdeChatMode('proj-b')).toBe('product');
    expect(readStoredIdeChatMode('missing')).toBeNull();
  });

  it('normalizes legacy mode ids', () => {
    stubStorage();
    store.set('nucleas.ide.chatMode.proj', 'build');
    expect(readStoredIdeChatMode('proj')).toBe('engineering');
  });

  it('persists Direct company and model', () => {
    stubStorage();
    writeStoredIdeDirectSelection('proj', { profileId: ' prof ', model: ' local/m ' });
    expect(readStoredIdeDirectSelection('proj')).toEqual({
      profileId: 'prof',
      model: 'local/m',
    });
  });

  it('ignores incomplete Direct payloads', () => {
    stubStorage();
    store.set('nucleas.ide.directSelection.proj', JSON.stringify({ profileId: 'only' }));
    expect(readStoredIdeDirectSelection('proj')).toBeNull();
  });
});
