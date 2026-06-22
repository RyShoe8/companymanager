import { describe, expect, it } from 'vitest';
import {
  canContributorUpdateTaskFields,
  hasRestrictedTaskFieldUpdates,
  parseContributorTaskFieldUpdates,
} from '@/lib/projects/taskFieldUpdateAuth';
import { isEmployeeAssignedToTask } from '@/lib/projects/taskLookup';

describe('parseContributorTaskFieldUpdates', () => {
  it('parses name, description, and estimatedHours', () => {
    const result = parseContributorTaskFieldUpdates({
      name: '  Fix logo  ',
      description: 'Update header',
      estimatedHours: 2,
    });
    expect(result.error).toBeUndefined();
    expect(result.updates).toEqual({
      name: 'Fix logo',
      description: 'Update header',
      estimatedHours: 2,
    });
  });

  it('rejects empty update body', () => {
    const result = parseContributorTaskFieldUpdates({});
    expect(result.error).toBe('At least one of name, description, or estimatedHours is required');
  });
});

describe('hasRestrictedTaskFieldUpdates', () => {
  it('detects manager-only fields', () => {
    expect(hasRestrictedTaskFieldUpdates({ startDate: '2026-01-01' })).toBe(true);
    expect(hasRestrictedTaskFieldUpdates({ assignedToEmployeeIds: [] })).toBe(true);
    expect(hasRestrictedTaskFieldUpdates({ name: 'x' })).toBe(false);
  });
});

describe('canContributorUpdateTaskFields', () => {
  it('allows managers', () => {
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: true,
        isAssigned: false,
        task: {},
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(true);
  });

  it('allows assignees and task creators', () => {
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        isAssigned: true,
        task: {},
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(true);
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        isAssigned: false,
        task: { createdByEmployeeId: 'emp1' },
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(true);
  });

  it('denies contributors who are not assigned or creator', () => {
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        isAssigned: false,
        task: { createdByEmployeeId: 'emp2' },
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(false);
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        isAssigned: false,
        task: {},
        currentUserEmployeeId: 'emp1',
      })
    ).toBe(false);
  });
});

describe('isEmployeeAssignedToTask', () => {
  it('matches employee id and name', () => {
    const task = {
      assignedToEmployeeId: { toString: () => 'emp1' },
      assignedToEmployeeIds: [{ toString: () => 'emp2' }],
      assignedTo: 'Alex',
    };
    expect(isEmployeeAssignedToTask(task, 'emp1', 'Alex')).toBe(true);
    expect(isEmployeeAssignedToTask(task, 'emp2', 'Alex')).toBe(true);
    expect(isEmployeeAssignedToTask(task, 'emp3', 'Alex')).toBe(true);
    expect(isEmployeeAssignedToTask(task, 'emp3', 'Sam')).toBe(false);
  });
});
