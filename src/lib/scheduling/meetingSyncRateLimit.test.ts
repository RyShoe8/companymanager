import { describe, expect, it } from 'vitest';
import {
  canStartMeetingSync,
  getMeetingSyncRetryMessage,
  MEETING_SYNC_MAX_PER_WINDOW,
  MEETING_SYNC_WINDOW_MS,
  pruneSyncTimestamps,
  recordMeetingSync,
} from '@/lib/scheduling/meetingSyncRateLimit';

describe('meetingSyncRateLimit', () => {
  const now = 1_700_000_000_000;

  it('prunes timestamps older than 30 minutes', () => {
    const timestamps = [now - MEETING_SYNC_WINDOW_MS - 1, now - 60_000, now - 30_000];
    expect(pruneSyncTimestamps(timestamps, now)).toEqual([now - 60_000, now - 30_000]);
  });

  it('allows sync when under the cap', () => {
    expect(canStartMeetingSync([], now)).toBe(true);
    expect(canStartMeetingSync([now - 60_000], now)).toBe(true);
  });

  it('blocks sync when at the cap within the window', () => {
    const timestamps = [now - 10 * 60_000, now - 5 * 60_000];
    expect(timestamps.length).toBe(MEETING_SYNC_MAX_PER_WINDOW);
    expect(canStartMeetingSync(timestamps, now)).toBe(false);
  });

  it('allows sync again after the oldest entry ages out', () => {
    const timestamps = [now - MEETING_SYNC_WINDOW_MS - 1, now - 5 * 60_000];
    expect(canStartMeetingSync(timestamps, now)).toBe(true);
  });

  it('records a sync and prunes expired entries', () => {
    const result = recordMeetingSync([now - MEETING_SYNC_WINDOW_MS - 1, now - 60_000], now);
    expect(result).toEqual([now - 60_000, now]);
  });

  it('returns retry message with minutes until oldest entry expires', () => {
    const timestamps = [now - 20 * 60_000, now - 10 * 60_000];
    const message = getMeetingSyncRetryMessage(timestamps, now);
    expect(message).toContain('2 per 30 minutes');
    expect(message).toContain('10 minutes');
  });
});
