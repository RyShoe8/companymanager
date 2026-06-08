import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markProjectItemsSeen,
  observeItemsForUser,
  readObservedItemsForUser,
  type ItemObservation,
} from '@/lib/workspace/itemSeenState';

const USER_ID = 'user-test';
const PROJECT_ID = 'project-1';
const EXISTING_TASK_KEY = `task:${PROJECT_ID}:task-existing`;
const NEW_TASK_KEY = `task:${PROJECT_ID}:task-new`;

function observation(
  key: string,
  signature: string,
  baseActivityMs = 1_000
): ItemObservation {
  return { key, signature, baseActivityMs };
}

describe('itemSeenState', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks first-time items as new after the global initialization pass', () => {
    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-existing')]);

    const result = observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new', 2_000),
    ]);

    expect(result.statusByKey[EXISTING_TASK_KEY]).toBe('none');
    expect(result.statusByKey[NEW_TASK_KEY]).toBe('new');
    expect(result.isNewByKey[NEW_TASK_KEY]).toBe(true);
  });

  it('clears new status after markProjectItemsSeen', () => {
    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-existing')]);
    observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new', 2_000),
    ]);

    markProjectItemsSeen(USER_ID, PROJECT_ID);

    const read = readObservedItemsForUser(USER_ID, [NEW_TASK_KEY]);
    expect(read.statusByKey[NEW_TASK_KEY]).toBe('none');
    expect(read.isNewByKey[NEW_TASK_KEY]).toBe(false);
  });

  it('marks signature changes as updated', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-v1', 500)]);

    vi.setSystemTime(5_000);
    const updated = observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-v2', 500)]);
    expect(updated.statusByKey[EXISTING_TASK_KEY]).toBe('updated');
    expect(updated.isNewByKey[EXISTING_TASK_KEY]).toBe(true);
  });
});
