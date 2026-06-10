import { describe, expect, it } from 'vitest';
import type { IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  filterContentToSeriesRepresentatives,
  filterTasksToSeriesRepresentatives,
} from '@/lib/recurrence/filterSeriesRepresentatives';
import { Types } from 'mongoose';

function task(
  id: string,
  start: string,
  status: IProjectTask['status'] = 'active',
  seriesId?: string
): IProjectTask {
  const startDate = new Date(start);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return {
    _id: id as unknown as IProjectTask['_id'],
    name: 'Task',
    startDate,
    endDate,
    status,
    recurrenceSeriesId: seriesId,
  };
}

describe('filterTasksToSeriesRepresentatives', () => {
  it('keeps all tasks without a series', () => {
    const tasks = [task('a', '2026-03-01'), task('b', '2026-03-02')];
    expect(filterTasksToSeriesRepresentatives(tasks, { mode: 'active' })).toHaveLength(2);
  });

  it('keeps only the next upcoming active instance per series', () => {
    const series = 'series-1';
    const tasks = [
      task('1', '2026-01-01', 'active', series),
      task('2', '2026-02-01', 'active', series),
      task('3', '2026-03-01', 'active', series),
    ];
    const reps = filterTasksToSeriesRepresentatives(tasks, {
      mode: 'active',
      referenceDate: new Date('2026-02-15'),
    });
    expect(reps).toHaveLength(1);
    expect(reps[0]._id?.toString()).toBe('3');
  });

  it('keeps the latest completed instance per series', () => {
    const series = 'series-1';
    const tasks = [
      task('1', '2026-01-01', 'completed', series),
      task('2', '2026-02-01', 'completed', series),
    ];
    const reps = filterTasksToSeriesRepresentatives(tasks, { mode: 'completed' });
    expect(reps).toHaveLength(1);
    expect(reps[0]._id?.toString()).toBe('2');
  });
});

describe('filterContentToSeriesRepresentatives', () => {
  it('keeps only the next upcoming unpublished item per series', () => {
    const projectId = new Types.ObjectId();
    const series = 'content-series';
    const items = [
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'A',
        channel: 'Email',
        status: 'planned',
        publishDate: new Date('2026-01-10'),
        recurrenceSeriesId: series,
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'B',
        channel: 'Email',
        status: 'planned',
        publishDate: new Date('2026-03-10'),
        recurrenceSeriesId: series,
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as unknown as IContentItem[];

    const reps = filterContentToSeriesRepresentatives(items, {
      mode: 'active',
      referenceDate: new Date('2026-02-01'),
    });
    expect(reps).toHaveLength(1);
    expect(reps[0].title).toBe('B');
  });
});
