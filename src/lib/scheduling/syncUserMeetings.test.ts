import { describe, expect, it } from 'vitest';
import { mergeSyncCounts } from '@/lib/scheduling/syncUserMeetings';

describe('syncUserMeetings', () => {
  it('mergeSyncCounts sums imported, updated, and removed', () => {
    expect(
      mergeSyncCounts(
        { imported: 2, updated: 3, removed: 1 },
        { imported: 1, updated: 0, removed: 2 }
      )
    ).toEqual({ imported: 3, updated: 3, removed: 3 });
  });

  it('mergeSyncCounts handles zero horizon result', () => {
    expect(
      mergeSyncCounts(
        { imported: 0, updated: 0, removed: 0 },
        { imported: 5, updated: 2, removed: 0 }
      )
    ).toEqual({ imported: 5, updated: 2, removed: 0 });
  });
});
