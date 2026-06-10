import { describe, expect, it } from 'vitest';
import { expandTaskInstances } from '@/lib/recurrence/expandTaskInstances';
import { findDuplicateTaskIds, taskIdString } from '@/lib/projects/taskArrayGuards';
import type { IProjectTask } from '@/lib/models/Project';

describe('task recurrence (preset-only)', () => {
  const baseTask: IProjectTask = {
    name: 'Weekly sync',
    startDate: new Date('2026-01-15T09:00:00'),
    endDate: new Date('2026-01-15T10:00:00'),
    status: 'active',
  };

  it('expandTaskInstances creates a bounded weekly series', () => {
    const instances = expandTaskInstances(baseTask, { preset: 'weekly' });
    expect(instances.length).toBeGreaterThanOrEqual(24);
    expect(instances.length).toBeLessThanOrEqual(28);
    expect(instances.every((t) => t.recurrenceSeriesId === instances[0].recurrenceSeriesId)).toBe(
      true
    );
    expect(instances.every((t) => t.recurrencePreset === 'weekly')).toBe(true);
  });

  it('returns single task for none preset path via one occurrence', () => {
    const instances = expandTaskInstances(baseTask, {
      preset: 'weekly',
      occurrenceStarts: [new Date(baseTask.startDate)],
    });
    expect(instances).toHaveLength(1);
  });

  it('keeps _id only on the first instance to avoid duplicate task IDs', () => {
    const taskId = '6a28f2e94de71a11d5ffc184';
    const taskWithId: IProjectTask = {
      ...baseTask,
      _id: taskId as unknown as IProjectTask['_id'],
    };
    const instances = expandTaskInstances(taskWithId, { preset: 'monthly' });

    expect(instances.length).toBeGreaterThan(1);
    expect(findDuplicateTaskIds(instances)).toEqual([]);
    expect(taskIdString(instances[0])).toBe(taskId);
    expect(instances.slice(1).every((t) => taskIdString(t) == null)).toBe(true);
  });
});
