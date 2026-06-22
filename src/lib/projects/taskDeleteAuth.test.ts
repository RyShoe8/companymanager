import { describe, expect, it } from 'vitest';
import { canDeleteTask, getTaskCreatorEmployeeId } from '@/lib/projects/taskDeleteAuth';

describe('canDeleteTask', () => {
  it('allows managers and admins to delete any task', () => {
    expect(
      canDeleteTask({
        task: {},
        isManagerOrAdmin: true,
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(true);
  });

  it('allows creators to delete their own tasks', () => {
    expect(
      canDeleteTask({
        task: { createdByEmployeeId: 'emp1' },
        isManagerOrAdmin: false,
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(true);
  });

  it('denies delete for other contributors', () => {
    expect(
      canDeleteTask({
        task: { createdByEmployeeId: 'emp2' },
        isManagerOrAdmin: false,
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(false);
  });

  it('denies delete for legacy tasks without creator', () => {
    expect(
      canDeleteTask({
        task: {},
        isManagerOrAdmin: false,
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(false);
  });
});

describe('getTaskCreatorEmployeeId', () => {
  it('reads string and object ids', () => {
    expect(getTaskCreatorEmployeeId({ createdByEmployeeId: 'abc' })).toBe('abc');
    expect(
      getTaskCreatorEmployeeId({
        createdByEmployeeId: { toString: () => 'obj-id' },
      })
    ).toBe('obj-id');
  });
});
