import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const STORAGE_KEY = `nucleas-item-seen:v1:${USER_ID}`;
const NEW_GRACE_PERIOD_MS = 30 * 60 * 1000;

function observation(
  key: string,
  signature: string,
  baseActivityMs = 1_000
): ItemObservation {
  return { key, signature, baseActivityMs };
}

describe('itemSeenState', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem(STORAGE_KEY);
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

  it('keeps new items labeled new when the signature changes during initial editing', () => {
    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-existing')]);
    observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new-empty', 2_000),
    ]);

    const edited = observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new-named', 2_000),
    ]);

    expect(edited.statusByKey[NEW_TASK_KEY]).toBe('new');
    expect(edited.isNewByKey[NEW_TASK_KEY]).toBe(true);
  });

  it('marks signature changes as updated after the new grace period expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-v1', 500)]);

    vi.setSystemTime(1_000 + NEW_GRACE_PERIOD_MS + 1);
    const updated = observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-v2', 500)]);
    expect(updated.statusByKey[EXISTING_TASK_KEY]).toBe('updated');
    expect(updated.isNewByKey[EXISTING_TASK_KEY]).toBe(true);
  });

  it('keeps new items labeled new within the 30-minute grace period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-existing')]);
    observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new-empty', 2_000),
    ]);

    vi.setSystemTime(1_000 + 15 * 60 * 1000);
    const edited = observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new-named', 2_000),
    ]);

    expect(edited.statusByKey[NEW_TASK_KEY]).toBe('new');
    expect(edited.isNewByKey[NEW_TASK_KEY]).toBe(true);
  });

  it('marks new items as updated after the grace period when edited again', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-existing')]);
    observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new-empty', 2_000),
    ]);

    vi.setSystemTime(1_000 + NEW_GRACE_PERIOD_MS + 1);
    const edited = observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, 'sig-new-named', 2_000),
    ]);

    expect(edited.statusByKey[NEW_TASK_KEY]).toBe('updated');
    expect(edited.isNewByKey[NEW_TASK_KEY]).toBe(true);
  });

  it('marks substantive signature changes as updated after markProjectItemsSeen when activity increases', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-active', 1_000)]);
    markProjectItemsSeen(USER_ID, PROJECT_ID);

    vi.setSystemTime(20_000);
    const updated = observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-in-review', 15_000),
    ]);

    expect(updated.statusByKey[EXISTING_TASK_KEY]).toBe('updated');
    expect(updated.isNewByKey[EXISTING_TASK_KEY]).toBe(true);
  });

  it('ignores comment-only signature drift after markProjectItemsSeen when base activity is unchanged', () => {
    const sigWithComments = JSON.stringify({
      taskId: 'task-new',
      name: 'Draft',
      status: 'active',
      commentActivityMs: 5_000,
    });
    const sigWithoutComments = JSON.stringify({
      taskId: 'task-new',
      name: 'Draft',
      status: 'active',
      commentActivityMs: 0,
    });

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-existing')]);
    observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, sigWithComments, 2_000),
    ]);

    markProjectItemsSeen(USER_ID, PROJECT_ID);

    const drift = observeItemsForUser(USER_ID, [
      observation(EXISTING_TASK_KEY, 'sig-existing'),
      observation(NEW_TASK_KEY, sigWithoutComments, 2_000),
    ]);

    expect(drift.statusByKey[NEW_TASK_KEY]).toBe('none');
    expect(drift.isNewByKey[NEW_TASK_KEY]).toBe(false);
  });

  it('does not mark signature drift as unseen when the project inspector is open', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    observeItemsForUser(USER_ID, [observation(EXISTING_TASK_KEY, 'sig-v1', 500)]);
    markProjectItemsSeen(USER_ID, PROJECT_ID);

    vi.setSystemTime(20_000);
    const edited = observeItemsForUser(
      USER_ID,
      [observation(EXISTING_TASK_KEY, 'sig-v2', 500)],
      { openProjectId: PROJECT_ID }
    );

    expect(edited.statusByKey[EXISTING_TASK_KEY]).toBe('none');
    expect(edited.isNewByKey[EXISTING_TASK_KEY]).toBe(false);
    expect(edited.activityByKey[EXISTING_TASK_KEY]).toBe(20_000);
  });

  it('still marks signature drift as updated on other projects when inspector is open elsewhere', () => {
    const otherProjectId = 'project-2';
    const otherTaskKey = `task:${otherProjectId}:task-other`;

    vi.useFakeTimers();
    vi.setSystemTime(10_000);

    observeItemsForUser(USER_ID, [observation(otherTaskKey, 'sig-v1', 500)]);
    markProjectItemsSeen(USER_ID, otherProjectId);

    vi.setSystemTime(20_000);
    const edited = observeItemsForUser(
      USER_ID,
      [observation(otherTaskKey, 'sig-v2', 500)],
      { openProjectId: PROJECT_ID }
    );

    expect(edited.statusByKey[otherTaskKey]).toBe('updated');
    expect(edited.isNewByKey[otherTaskKey]).toBe(true);
  });
});
