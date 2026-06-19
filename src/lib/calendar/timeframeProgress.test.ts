import { describe, expect, it } from 'vitest';
import { computeProjectTimeframeProgress } from './timeframeProgress';
import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';

function makeProject(tasks: IProject['tasks']): IProject {
  return {
    _id: 'proj1' as unknown as IProject['_id'],
    name: 'Test',
    tasks,
  } as IProject;
}

describe('computeProjectTimeframeProgress', () => {
  const rangeStart = new Date('2026-06-01T00:00:00');
  const rangeEnd = new Date('2026-06-30T23:59:59');
  const referenceDate = new Date('2026-06-15T12:00:00');

  it('returns 20% when 1 of 6 tasks and 1 of 4 content items are done in range', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      name: `Task ${i + 1}`,
      status: i === 0 ? 'completed' : 'in_progress',
      startDate: new Date('2026-06-05'),
      endDate: new Date('2026-06-10'),
    }));

    const contentItems: IContentItem[] = Array.from({ length: 4 }, (_, i) => ({
      _id: `c${i}` as unknown as IContentItem['_id'],
      projectId: 'proj1' as unknown as IContentItem['projectId'],
      title: `Content ${i + 1}`,
      channel: 'Article',
      status: i === 0 ? 'published' : 'planned',
      publishDate: new Date(`2026-06-${10 + i}`),
    })) as IContentItem[];

    const progress = computeProjectTimeframeProgress(
      makeProject(tasks),
      contentItems,
      rangeStart,
      rangeEnd,
      referenceDate
    );

    expect(progress).toBe(20);
  });

  it('returns 0 when no items fall in range', () => {
    const progress = computeProjectTimeframeProgress(
      makeProject([]),
      [],
      rangeStart,
      rangeEnd,
      referenceDate
    );
    expect(progress).toBe(0);
  });
});
