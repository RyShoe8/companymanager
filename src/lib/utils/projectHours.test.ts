import { describe, expect, it } from 'vitest';
import Project, { type IProjectTask } from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';
import { computeProjectAssignedHours } from '@/lib/utils/projectHours';
import { Types } from 'mongoose';

function task(partial: Partial<IProjectTask>): IProjectTask {
  return {
    name: 'Task',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-07'),
    ...partial,
  };
}

describe('computeProjectAssignedHours', () => {
  const projectId = new Types.ObjectId();

  it('sums non-completed task hours and non-published content hours', () => {
    const tasks = [
      task({ estimatedHours: 5, status: 'active' }),
      task({ estimatedHours: 3, status: 'in-review' }),
      task({ estimatedHours: 10, status: 'completed' }),
    ];
    const content = [
      { projectId, estimatedHours: 2, status: 'in_progress' },
      { projectId, estimatedHours: 8, status: 'published' },
      { projectId, estimatedHours: 4, status: 'ready' },
    ].map((item) => new ContentItem(item));

    expect(computeProjectAssignedHours(new Project({ _id: projectId, tasks }), content)).toBe(14);
  });

  it('ignores tasks and content on other projects', () => {
    const otherProjectId = new Types.ObjectId();
    const tasks = [task({ estimatedHours: 6, status: 'active' })];
    const content = [
      { projectId: otherProjectId, estimatedHours: 20, status: 'planned' },
    ].map((item) => new ContentItem(item));

    expect(computeProjectAssignedHours(new Project({ _id: projectId, tasks }), content)).toBe(6);
  });
});
