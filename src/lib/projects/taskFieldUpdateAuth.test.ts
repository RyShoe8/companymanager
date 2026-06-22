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
        canContribute: false,
        isAssigned: false,
      })
    ).toBe(true);
  });

  it('allows project contributors and assignees', () => {
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        canContribute: true,
        isAssigned: false,
      })
    ).toBe(true);
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        canContribute: false,
        isAssigned: true,
      })
    ).toBe(true);
  });

  it('denies unrelated users', () => {
    expect(
      canContributorUpdateTaskFields({
        isManagerOrAdmin: false,
        canContribute: false,
        isAssigned: false,
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
