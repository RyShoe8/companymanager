import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import { getProjectLatestActivityMs } from '@/lib/utils/projectLatestActivity';

describe('getProjectLatestActivityMs', () => {
  it('uses task completedAt when newer than project updatedAt', () => {
    const completedAt = new Date('2026-06-15T12:00:00Z');
    const project = {
      _id: new Types.ObjectId(),
      name: 'P',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-06-01'),
      tasks: [
        {
          name: 'Done',
          status: 'completed',
          completedAt,
        } as IProjectTask,
      ],
    } as IProject;

    expect(getProjectLatestActivityMs(project)).toBe(completedAt.getTime());
  });

  it('prefers latest comment ms over project and task timestamps', () => {
    const project = {
      _id: new Types.ObjectId(),
      name: 'P',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-06-01'),
      tasks: [
        {
          name: 'Done',
          status: 'completed',
          completedAt: new Date('2026-06-10'),
        } as IProjectTask,
      ],
    } as IProject;
    const commentMs = new Date('2026-06-20').getTime();

    expect(getProjectLatestActivityMs(project, [], commentMs)).toBe(commentMs);
  });
});
