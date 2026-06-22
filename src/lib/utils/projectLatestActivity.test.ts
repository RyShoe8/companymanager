import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import { getProjectLatestActivityMs, getEffectiveProjectActivityMs, compareProjectsForWorkspaceSort } from '@/lib/utils/projectLatestActivity';

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

describe('getEffectiveProjectActivityMs', () => {
  it('uses the highest of server, item, and local touch timestamps', () => {
    expect(getEffectiveProjectActivityMs(100, 200, 150)).toBe(200);
    expect(getEffectiveProjectActivityMs(100, 200, 300)).toBe(300);
    expect(getEffectiveProjectActivityMs(400, 200, 300)).toBe(400);
  });
});

describe('compareProjectsForWorkspaceSort', () => {
  it('sorts by activity before unseen count', () => {
    expect(compareProjectsForWorkspaceSort(100, 5, 200, 0)).toBeGreaterThan(0);
    expect(compareProjectsForWorkspaceSort(300, 0, 200, 10)).toBeLessThan(0);
  });

  it('uses unseen count as a tiebreaker', () => {
    expect(compareProjectsForWorkspaceSort(200, 1, 200, 3)).toBeGreaterThan(0);
    expect(compareProjectsForWorkspaceSort(200, 3, 200, 1)).toBeLessThan(0);
  });
});
