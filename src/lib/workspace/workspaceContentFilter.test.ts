import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import ContentItem from '@/lib/models/ContentItem';
import { filterContentItemsForMyAssignments } from '@/lib/workspace/workspaceContentFilter';

describe('filterContentItemsForMyAssignments', () => {
  const employeeId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  it('includes items assigned to the current employee', () => {
    const items = [
      new ContentItem({
        _id: new Types.ObjectId(),
        assignedToEmployeeId: employeeId,
        userId: new Types.ObjectId(),
      }),
    ];
    expect(filterContentItemsForMyAssignments(items, employeeId, userId)).toHaveLength(1);
  });

  it('includes items created by the current user', () => {
    const items = [
      new ContentItem({
        _id: new Types.ObjectId(),
        userId,
      }),
    ];
    expect(filterContentItemsForMyAssignments(items, employeeId, userId)).toHaveLength(1);
  });

  it('excludes unrelated items', () => {
    const items = [
      new ContentItem({
        _id: new Types.ObjectId(),
        assignedToEmployeeId: new Types.ObjectId(),
        userId: new Types.ObjectId(),
      }),
    ];
    expect(filterContentItemsForMyAssignments(items, employeeId, userId)).toHaveLength(0);
  });
});
