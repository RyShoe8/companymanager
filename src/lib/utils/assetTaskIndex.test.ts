import { describe, expect, it } from 'vitest';
import { initialAssetTaskIndex } from './assetTaskIndex';
describe('initial asset task reference', () => {
  it('preserves existing zero and nonzero indices', () => {
    expect(initialAssetTaskIndex(0)).toBe('0');
    expect(initialAssetTaskIndex(3, undefined, 7)).toBe('3');
  });
  it('prefers stable references over positional fallbacks', () => {
    expect(initialAssetTaskIndex(3, 'task-id', 7)).toBe('');
    expect(initialAssetTaskIndex(undefined, undefined, 7, 'task-id')).toBe('');
  });
  it('uses an initial index only when no existing reference exists', () => {
    expect(initialAssetTaskIndex(undefined, undefined, 0)).toBe('0');
    expect(initialAssetTaskIndex()).toBe('');
  });
});
