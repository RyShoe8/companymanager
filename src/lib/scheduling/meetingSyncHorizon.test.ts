import { describe, expect, it } from 'vitest';
import {
  getDesiredSyncWindow,
  getFullSyncChunks,
  getSyncGapChunks,
  MEETING_SYNC_CHUNK_DAYS,
} from '@/lib/scheduling/meetingSyncHorizon';

describe('meetingSyncHorizon', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('defines a six-month forward desired window', () => {
    const { start, end } = getDesiredSyncWindow(now);
    expect(start.getTime()).toBeLessThan(now.getTime());
    const monthsAhead = (end.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000);
    expect(monthsAhead).toBeGreaterThan(5.5);
    expect(monthsAhead).toBeLessThan(6.5);
  });

  it('returns full chunks when no horizon is stored', () => {
    const desired = getDesiredSyncWindow(now);
    const chunks = getFullSyncChunks(desired);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].start.getTime()).toBe(desired.start.getTime());
    expect(chunks[chunks.length - 1].end.getTime()).toBe(desired.end.getTime());
  });

  it('returns only gap chunks after stored horizon end', () => {
    const desired = getDesiredSyncWindow(now);
    const storedEnd = new Date(now);
    storedEnd.setDate(storedEnd.getDate() + MEETING_SYNC_CHUNK_DAYS);
    const chunks = getSyncGapChunks(storedEnd, desired);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].start.getTime()).toBeGreaterThan(storedEnd.getTime());
  });

  it('returns no chunks when horizon already covers desired end', () => {
    const desired = getDesiredSyncWindow(now);
    const storedEnd = new Date(desired.end);
    storedEnd.setDate(storedEnd.getDate() + 1);
    expect(getSyncGapChunks(storedEnd, desired)).toEqual([]);
  });
});
