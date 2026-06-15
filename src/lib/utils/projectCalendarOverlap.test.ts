import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { projectOverlapsDateRange } from '@/lib/utils/projectCalendarOverlap';

function task(partial: Partial<IProjectTask>): IProjectTask {
  return {
    name: 'Task',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-07'),
    ...partial,
  };
}

function weekRange(startDay: string, endDay: string) {
  const rangeStart = new Date(`${startDay}T00:00:00`);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(`${endDay}T23:59:59.999`);
  rangeEnd.setHours(23, 59, 59, 999);
  return { rangeStart, rangeEnd };
}

describe('projectOverlapsDateRange', () => {
  const projectId = new Types.ObjectId();

  it('includes project when old task exists but current-month task overlaps range', () => {
    const project = {
      _id: projectId,
      createdAt: new Date('2024-01-01'),
      tasks: [
        task({ name: 'Old', startDate: new Date('2024-01-01'), endDate: new Date('2024-01-05') }),
        task({ name: 'Current', startDate: new Date('2026-06-15'), endDate: new Date('2026-06-19') }),
      ],
    } as unknown as IProject;
    const { rangeStart, rangeEnd } = weekRange('2026-06-15', '2026-06-21');
    expect(projectOverlapsDateRange(project, rangeStart, rangeEnd)).toBe(true);
  });

  it('includes project when only task Jun 15-19 vs week Jun 15-21', () => {
    const project = {
      _id: projectId,
      createdAt: new Date('2026-01-01'),
      tasks: [task({ startDate: new Date('2026-06-15'), endDate: new Date('2026-06-19') })],
    } as unknown as IProject;
    const { rangeStart, rangeEnd } = weekRange('2026-06-15', '2026-06-21');
    expect(projectOverlapsDateRange(project, rangeStart, rangeEnd)).toBe(true);
  });

  it('excludes project when only task Jun 15-19 vs week Jun 8-14', () => {
    const project = {
      _id: projectId,
      createdAt: new Date('2026-01-01'),
      tasks: [task({ startDate: new Date('2026-06-15'), endDate: new Date('2026-06-19') })],
    } as unknown as IProject;
    const { rangeStart, rangeEnd } = weekRange('2026-06-08', '2026-06-14');
    expect(projectOverlapsDateRange(project, rangeStart, rangeEnd)).toBe(false);
  });

  it('includes task-less project when createdAt falls in range (fallback)', () => {
    const project = {
      _id: projectId,
      createdAt: new Date('2026-06-10'),
      tasks: [],
    } as unknown as IProject;
    const { rangeStart, rangeEnd } = weekRange('2026-06-08', '2026-06-14');
    expect(projectOverlapsDateRange(project, rangeStart, rangeEnd)).toBe(true);
  });

  it('excludes project when tasks exist but none overlap range', () => {
    const project = {
      _id: projectId,
      createdAt: new Date('2026-01-01'),
      tasks: [task({ startDate: new Date('2026-03-01'), endDate: new Date('2026-03-05') })],
    } as unknown as IProject;
    const { rangeStart, rangeEnd } = weekRange('2026-06-08', '2026-06-14');
    expect(projectOverlapsDateRange(project, rangeStart, rangeEnd)).toBe(false);
  });

  it('includes project when content publish date falls in range', () => {
    const project = {
      _id: projectId,
      createdAt: new Date('2024-01-01'),
      tasks: [task({ startDate: new Date('2024-01-01'), endDate: new Date('2024-01-05') })],
    } as unknown as IProject;
    const content = [
      {
        _id: new Types.ObjectId(),
        projectId,
        title: 'Post',
        publishDate: new Date('2026-06-12'),
        status: 'in_progress',
      },
    ] as unknown as IContentItem[];
    const { rangeStart, rangeEnd } = weekRange('2026-06-08', '2026-06-14');
    expect(projectOverlapsDateRange(project, rangeStart, rangeEnd, content)).toBe(true);
  });
});
