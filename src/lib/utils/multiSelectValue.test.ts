import { describe, expect, it } from 'vitest';
import { toggleMultiSelectValue } from '@/lib/utils/multiSelectValue';

describe('toggleMultiSelectValue', () => {
  it('adds a value when not selected', () => {
    expect(toggleMultiSelectValue([], 'a')).toEqual(['a']);
    expect(toggleMultiSelectValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a value when already selected', () => {
    expect(toggleMultiSelectValue(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleMultiSelectValue(['a'], 'a')).toEqual([]);
  });

  it('composes sequential toggles like rapid clicks before parent re-render', () => {
    let selected: string[] = [];
    selected = toggleMultiSelectValue(selected, 'person-a');
    selected = toggleMultiSelectValue(selected, 'person-b');
    expect(selected).toEqual(['person-a', 'person-b']);
  });
});
