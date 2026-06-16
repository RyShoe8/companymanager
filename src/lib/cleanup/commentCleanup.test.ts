import { describe, expect, it } from 'vitest';
import {
  contentItemCommentsFilter,
  projectCommentsFilter,
  taskCommentsFilter,
} from '@/lib/cleanup/commentFilters';

describe('commentFilters', () => {
  it('builds project and projectTask comment filter', () => {
    const projectId = '674a00000000000000000101';
    const filter = projectCommentsFilter(projectId);
    expect(filter).toHaveProperty('$or');
    expect(JSON.stringify(filter)).toContain('project');
    expect(JSON.stringify(filter)).toContain('projectTask');
  });

  it('builds task comment filter with taskId', () => {
    const projectId = '674a00000000000000000101';
    const taskId = '674a00000000000000000201';
    const filter = taskCommentsFilter(projectId, taskId);
    expect(filter.entityType).toBe('projectTask');
    expect(JSON.stringify(filter)).toContain(taskId);
  });

  it('builds task comment filter with legacy taskIndex', () => {
    const projectId = '674a00000000000000000101';
    const filter = taskCommentsFilter(projectId, undefined, 2);
    expect(filter).toMatchObject({
      entityType: 'projectTask',
      taskIndex: 2,
    });
  });

  it('builds content item comment filter', () => {
    const contentId = '674a00000000000000000301';
    const filter = contentItemCommentsFilter(contentId);
    expect(filter).toMatchObject({
      entityType: 'contentItem',
    });
  });

  it('returns impossible filter for invalid ids', () => {
    expect(projectCommentsFilter('invalid')).toEqual({ _id: null });
  });
});
