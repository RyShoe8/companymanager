import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IContentItem } from '@/lib/models/ContentItem';
import { filterContentItemsForMyAssignments } from '@/lib/workspace/workspaceContentFilter';

describe('filterContentItemsForMyAssignments', () => {
  const employeeId = 'emp-1';
  const userId = 'user-1';

  it('includes items assigned to the current employee', () => {
    const items = [
      {
        _id: new Types.ObjectId(),
        assignedToEmployeeId: employeeId,
        userId: 'other',
      } as IContentItem,
    ];
    expect(filterContentItemsForMyAssignments(items, employeeId, userId)).toHaveLength(1);
  });

  it('includes items created by the current user', () => {
    const items = [
      {
        _id: new Types.ObjectId(),
        userId,
      } as IContentItem,
    ];
    expect(filterContentItemsForMyAssignments(items, employeeId, userId)).toHaveLength(1);
  });

  it('excludes unrelated items', () => {
    const items = [
      {
        _id: new Types.ObjectId(),
        assignedToEmployeeId: 'emp-2',
        userId: 'user-2',
      } as IContentItem,
    ];
    expect(filterContentItemsForMyAssignments(items, employeeId, userId)).toHaveLength(0);
  });
});
