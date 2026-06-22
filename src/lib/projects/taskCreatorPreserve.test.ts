import { describe, expect, it } from 'vitest';
import { resolveTaskCreatedByEmployeeId } from '@/lib/projects/taskCreatorPreserve';

describe('resolveTaskCreatedByEmployeeId', () => {
  it('prefers incoming creator id', () => {
    expect(
      resolveTaskCreatedByEmployeeId(
        { createdByEmployeeId: 'emp-new' },
        { createdByEmployeeId: 'emp-old' }
      )
    ).toBe('emp-new');
  });

  it('falls back to previous task creator id', () => {
    expect(resolveTaskCreatedByEmployeeId({}, { createdByEmployeeId: 'emp-old' })).toBe('emp-old');
    expect(
      resolveTaskCreatedByEmployeeId(
        {},
        { createdByEmployeeId: { toString: () => 'obj-id' } }
      )
    ).toBe('obj-id');
  });

  it('returns null when no creator is available', () => {
    expect(resolveTaskCreatedByEmployeeId({}, undefined)).toBeNull();
  });
});
