import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { buildProjectEntityRangeItems } from '@/lib/calendar/projectEntityRangeItems';

function task(
  id: string,
  start: string,
  status: IProjectTask['status'] = 'active',
  seriesId?: string
): IProjectTask {
  const startDate = new Date(start);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  return {
    _id: id as unknown as IProjectTask['_id'],
    name: `Task ${id}`,
    startDate,
    endDate,
    status,
    recurrenceSeriesId: seriesId,
  };
}

describe('buildProjectEntityRangeItems', () => {
  const projectId = new Types.ObjectId();
  const weekStart = new Date('2026-06-08');
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date('2026-06-14');
  weekEnd.setHours(23, 59, 59, 999);

  it('counts and lists only active items in the viewed range', () => {
    const series = 'task-series';
    const project = {
      _id: projectId,
      name: 'P',
      tasks: [
        task('1', '2026-06-01', 'active', series),
        task('2', '2026-06-10', 'active', series),
        task('3', '2026-07-01', 'active', series),
        task('4', '2026-06-11', 'completed'),
      ],
    } as IProject;

    const result = buildProjectEntityRangeItems(
      project,
      [],
      weekStart,
      weekEnd,
      new Date('2026-06-10')
    );

    expect(result.openTaskCount).toBe(1);
    expect(result.displayList).toHaveLength(1);
    expect(result.displayList[0].type).toBe('task');
    if (result.displayList[0].type === 'task') {
      expect(result.displayList[0].task._id?.toString()).toBe('2');
    }
  });

  it('shows recurring content in-range instead of the global upcoming rep', () => {
    const series = 'content-series';
    const items = [
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'July',
        channel: 'Email',
        status: 'planned',
        publishDate: new Date('2026-07-10'),
        recurrenceSeriesId: series,
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'June week',
        channel: 'Email',
        status: 'planned',
        publishDate: new Date('2026-06-10'),
        recurrenceSeriesId: series,
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as IContentItem[];

    const project = { _id: projectId, name: 'P', tasks: [] } as IProject;
    const result = buildProjectEntityRangeItems(
      project,
      items,
      weekStart,
      weekEnd,
      new Date('2026-06-01')
    );

    expect(result.openContentCount).toBe(1);
    expect(result.displayList).toHaveLength(1);
    expect(result.displayList[0].type).toBe('content');
    if (result.displayList[0].type === 'content') {
      expect(result.displayList[0].content.title).toBe('June week');
    }
  });

  it('includes undated active content in any timeframe', () => {
    const items = [
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'Undated',
        channel: 'Email',
        status: 'planned',
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as IContentItem[];
    const project = { _id: projectId, name: 'P', tasks: [] } as IProject;

    const result = buildProjectEntityRangeItems(project, items, weekStart, weekEnd, new Date());

    expect(result.openContentCount).toBe(1);
    expect(result.displayList).toHaveLength(1);
  });

  it('includes open-ended active tasks in the viewed range', () => {
    const project = {
      _id: projectId,
      name: 'P',
      tasks: [
        {
          _id: 'open1' as unknown as IProjectTask['_id'],
          name: 'Ongoing client work',
          startDate: new Date('2026-06-01'),
          endDate: null,
          status: 'active',
        },
      ],
    } as IProject;

    const result = buildProjectEntityRangeItems(
      project,
      [],
      weekStart,
      weekEnd,
      new Date('2026-06-10')
    );

    expect(result.openTaskCount).toBe(1);
    expect(result.displayList).toHaveLength(1);
    expect(result.displayList[0].type).toBe('task');
  });

  it('applies channel filter to counts and display list', () => {
    const items = [
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'Email post',
        channel: 'Email',
        status: 'planned',
        publishDate: new Date('2026-06-10'),
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'Social post',
        channel: 'Social',
        status: 'planned',
        publishDate: new Date('2026-06-11'),
        userId: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as IContentItem[];
    const project = { _id: projectId, name: 'P', tasks: [] } as IProject;

    const result = buildProjectEntityRangeItems(
      project,
      items,
      weekStart,
      weekEnd,
      new Date(),
      { contentChannelFilter: 'Email' }
    );

    expect(result.openContentCount).toBe(1);
    expect(result.displayList).toHaveLength(1);
    if (result.displayList[0].type === 'content') {
      expect(result.displayList[0].content.channel).toBe('Email');
    }
  });
});
