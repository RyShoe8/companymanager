import { describe, expect, it } from 'vitest';
import {
  dedupeProjectTasks,
  findDuplicateTaskIds,
  validateIncomingTaskArray,
  MAX_TASK_APPEND,
  MAX_TASK_COUNT_INCREASE,
} from '@/lib/projects/taskArrayGuards';

describe('taskArrayGuards', () => {
  it('finds duplicate task ids', () => {
    const dupes = findDuplicateTaskIds([
      { _id: 'a' },
      { _id: 'b' },
      { _id: 'a' },
    ]);
    expect(dupes).toEqual(['a']);
  });

  it('rejects duplicate ids on PUT', () => {
    const error = validateIncomingTaskArray({
      previousCount: 2,
      incomingTasks: [{ _id: 'a' }, { _id: 'a' }],
    });
    expect(error).toMatch(/Duplicate task IDs/);
  });

  it('rejects abnormal task count growth without bulk expand', () => {
    const incoming = Array.from({ length: 30 }, (_, i) => ({ name: `Task ${i}` }));
    const error = validateIncomingTaskArray({
      previousCount: 5,
      incomingTasks: incoming,
    });
    expect(error).toMatch(String(MAX_TASK_COUNT_INCREASE));
  });

  it('allows bulk expand when flagged', () => {
    const incoming = Array.from({ length: 50 }, (_, i) => ({ name: `Task ${i}` }));
    const error = validateIncomingTaskArray({
      previousCount: 5,
      incomingTasks: incoming,
      allowBulkTaskExpand: true,
    });
    expect(error).toBeNull();
  });

  it('rejects large append batches', () => {
    const incoming = Array.from({ length: MAX_TASK_APPEND + 1 }, (_, i) => ({ name: `Task ${i}` }));
    const error = validateIncomingTaskArray({
      previousCount: 10,
      incomingTasks: incoming,
      isAppend: true,
    });
    expect(error).toMatch(String(MAX_TASK_APPEND));
  });

  it('dedupes tasks with identical signatures keeping the first', () => {
    const tasks = [
      { _id: '1', name: 'Design', status: 'active', startDate: '2026-06-01', endDate: '2026-06-02' },
      { _id: '2', name: 'Design', status: 'active', startDate: '2026-06-01', endDate: '2026-06-02' },
      { _id: '3', name: 'Build', status: 'active', startDate: '2026-06-03', endDate: '2026-06-04' },
    ];
    const deduped = dedupeProjectTasks(tasks);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]._id).toBe('1');
    expect(deduped[1]._id).toBe('3');
  });
});
