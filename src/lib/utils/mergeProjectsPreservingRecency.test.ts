import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import { mergeProjectsPreservingRecency } from '@/lib/utils/mergeProjectsPreservingRecency';

describe('mergeProjectsPreservingRecency', () => {
  const projectId = new Types.ObjectId();

  it('keeps newer local updatedAt when fetch is stale', () => {
    const localUpdatedAt = new Date('2026-06-15T12:00:00Z');
    const staleUpdatedAt = new Date('2026-06-01T12:00:00Z');
    const previous = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: localUpdatedAt,
        tasks: [],
      } as IProject,
    ];
    const fetched = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: staleUpdatedAt,
        tasks: [],
      } as IProject,
    ];

    const merged = mergeProjectsPreservingRecency(previous, fetched);
    expect(new Date(merged[0].updatedAt!).getTime()).toBe(localUpdatedAt.getTime());
  });

  it('keeps local tasks when they have newer completedAt than fetch', () => {
    const completedAt = new Date('2026-06-15T12:00:00Z');
    const localTasks = [
      { name: 'T', status: 'completed', completedAt } as IProjectTask,
    ];
    const fetchedTasks = [{ name: 'T', status: 'active' } as IProjectTask];
    const previous = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: new Date('2026-06-15T12:00:00Z'),
        tasks: localTasks,
      } as IProject,
    ];
    const fetched = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: new Date('2026-06-01'),
        tasks: fetchedTasks,
      } as IProject,
    ];

    const merged = mergeProjectsPreservingRecency(previous, fetched);
    expect(merged[0].tasks?.[0]?.completedAt).toEqual(completedAt);
    expect(merged[0].tasks?.[0]?.status).toBe('completed');
  });

  it('accepts fetched project when it is newer than local', () => {
    const previous = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: new Date('2026-06-01'),
        tasks: [],
      } as IProject,
    ];
    const fetchedUpdatedAt = new Date('2026-06-20');
    const fetched = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: fetchedUpdatedAt,
        tasks: [],
      } as IProject,
    ];

    const merged = mergeProjectsPreservingRecency(previous, fetched);
    expect(new Date(merged[0].updatedAt!).getTime()).toBe(fetchedUpdatedAt.getTime());
  });

  it('keeps newer local recency when content timestamps are newer than fetch', () => {
    const localUpdatedAt = new Date('2026-06-01T12:00:00Z');
    const contentUpdatedAt = new Date('2026-06-15T12:00:00Z');
    const staleUpdatedAt = new Date('2026-06-01T12:00:00Z');
    const projectIdStr = projectId.toString();
    const previous = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: localUpdatedAt,
        tasks: [],
      } as IProject,
    ];
    const fetched = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: staleUpdatedAt,
        tasks: [],
      } as IProject,
    ];
    const contentByProjectId = new Map([
      [
        projectIdStr,
        [
          {
            _id: projectId,
            updatedAt: contentUpdatedAt,
            createdAt: contentUpdatedAt,
          } as import('@/lib/models/ContentItem').IContentItem,
        ],
      ],
    ]);

    const merged = mergeProjectsPreservingRecency(previous, fetched, { contentByProjectId });
    expect(new Date(merged[0].updatedAt!).getTime()).toBe(localUpdatedAt.getTime());
  });

  it('does not resurrect tasks removed on the server', () => {
    const taskId = new Types.ObjectId();
    const completedAt = new Date('2026-06-15T12:00:00Z');
    const localTasks = [
      { _id: taskId, name: 'Kept', status: 'completed', completedAt } as IProjectTask,
      { _id: new Types.ObjectId(), name: 'Deleted locally', status: 'active' } as IProjectTask,
    ];
    const fetchedTasks = [
      { _id: taskId, name: 'Kept', status: 'active' } as IProjectTask,
    ];
    const previous = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: new Date('2026-06-15T12:00:00Z'),
        tasks: localTasks,
      } as IProject,
    ];
    const fetched = [
      {
        _id: projectId,
        name: 'P',
        updatedAt: new Date('2026-06-01'),
        tasks: fetchedTasks,
      } as IProject,
    ];

    const merged = mergeProjectsPreservingRecency(previous, fetched);
    expect(merged[0].tasks).toHaveLength(1);
    expect(merged[0].tasks?.[0]?.completedAt).toEqual(completedAt);
    expect(merged[0].tasks?.[0]?.status).toBe('completed');
  });
});
