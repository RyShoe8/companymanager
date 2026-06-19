import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  countActiveContentForDisplay,
  countActiveTasksForDisplay,
  countActiveTasksForDisplayInRange,
} from '@/lib/workspace/projectDisplayCounts';

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

describe('projectDisplayCounts', () => {
  it('dedupes recurring active tasks to one representative', () => {
    const project = {
      _id: new Types.ObjectId(),
      name: 'P',
      tasks: [
        task('1', '2026-01-01', 'active', 'series-1'),
        task('2', '2026-02-01', 'active', 'series-1'),
        task('3', '2026-03-01', 'active', 'series-1'),
      ],
    } as IProject;

    expect(countActiveTasksForDisplay(project, new Date('2026-02-15'))).toBe(1);
  });

  it('excludes completed tasks from active count', () => {
    const project = {
      _id: new Types.ObjectId(),
      name: 'P',
      tasks: [task('1', '2026-03-01', 'completed'), task('2', '2026-03-02', 'active')],
    } as IProject;

    expect(countActiveTasksForDisplay(project)).toBe(1);
  });

  it('dedupes recurring active content to one representative', () => {
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
    ] as IContentItem[];

    expect(countActiveContentForDisplay(projectId.toString(), items, new Date('2026-02-15'))).toBe(1);
  });

  it('excludes published content from active count', () => {
    const projectId = new Types.ObjectId();
    const items = [
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'Done',
        channel: 'Email',
        status: 'published',
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'Open',
        channel: 'Email',
        status: 'planned',
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as IContentItem[];

    expect(countActiveContentForDisplay(projectId.toString(), items)).toBe(1);
  });

  it('counts only in-range active tasks via InRange helper', () => {
    const project = {
      _id: new Types.ObjectId(),
      name: 'P',
      tasks: [
        task('1', '2026-06-01', 'active'),
        task('2', '2026-06-10', 'active'),
      ],
    } as IProject;
    const weekStart = new Date('2026-06-08');
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date('2026-06-14');
    weekEnd.setHours(23, 59, 59, 999);

    expect(
      countActiveTasksForDisplayInRange(project, [], weekStart, weekEnd, new Date('2026-06-10'))
    ).toBe(1);
  });
});
