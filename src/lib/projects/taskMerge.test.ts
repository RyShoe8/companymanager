import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProjectTask } from '@/lib/models/Project';
import { mergeTasksPreservingReferences, tasksSemanticallyEqual } from '@/lib/projects/taskMerge';

describe('tasksSemanticallyEqual', () => {
  it('treats assignee changes as unequal', () => {
    const aId = new Types.ObjectId().toString();
    const bId = new Types.ObjectId().toString();
    const base = {
      name: 'Task',
      description: '',
      status: 'active',
      estimatedHours: 2,
    } as IProjectTask;

    expect(
      tasksSemanticallyEqual(
        { ...base, assignedToEmployeeIds: [aId] },
        { ...base, assignedToEmployeeIds: [aId, bId] }
      )
    ).toBe(false);

    expect(
      tasksSemanticallyEqual(
        { ...base, assignedToEmployeeIds: [aId, bId] },
        { ...base, assignedToEmployeeIds: [aId, bId] }
      )
    ).toBe(true);
  });
});

describe('mergeTasksPreservingReferences', () => {
  it('uses server task when only assignees differ', () => {
    const taskId = new Types.ObjectId();
    const aId = new Types.ObjectId().toString();
    const bId = new Types.ObjectId().toString();
    const prev: IProjectTask[] = [
      {
        _id: taskId,
        name: 'Task',
        status: 'active',
        assignedToEmployeeIds: [aId, bId] as never,
      } as IProjectTask,
    ];
    const server: IProjectTask[] = [
      {
        _id: taskId,
        name: 'Task',
        status: 'active',
        assignedToEmployeeIds: [aId] as never,
      } as IProjectTask,
    ];

    const merged = mergeTasksPreservingReferences(prev, server);
    expect(merged[0]).toBe(server[0]);
    expect(merged[0].assignedToEmployeeIds).toEqual([aId]);
  });

  it('preserves previous reference when assignees and other fields match', () => {
    const taskId = new Types.ObjectId();
    const aId = new Types.ObjectId().toString();
    const prevTask = {
      _id: taskId,
      name: 'Task',
      status: 'active',
      assignedToEmployeeIds: [aId] as never,
    } as IProjectTask;
    const serverTask = {
      _id: taskId,
      name: 'Task',
      status: 'active',
      assignedToEmployeeIds: [aId] as never,
    } as IProjectTask;

    const merged = mergeTasksPreservingReferences([prevTask], [serverTask]);
    expect(merged[0]).toBe(prevTask);
  });
});
