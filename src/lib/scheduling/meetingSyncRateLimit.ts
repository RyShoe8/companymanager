export const MEETING_SYNC_MAX_PER_WINDOW = 2;
export const MEETING_SYNC_WINDOW_MS = 30 * 60 * 1000;

export function pruneSyncTimestamps(timestamps: number[], now = Date.now()): number[] {
  const cutoff = now - MEETING_SYNC_WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

export function canStartMeetingSync(timestamps: number[], now = Date.now()): boolean {
  return pruneSyncTimestamps(timestamps, now).length < MEETING_SYNC_MAX_PER_WINDOW;
}

export function recordMeetingSync(timestamps: number[], now = Date.now()): number[] {
  return pruneSyncTimestamps([...timestamps, now], now);
}

export function getMeetingSyncRetryMessage(timestamps: number[], now = Date.now()): string {
  const pruned = pruneSyncTimestamps(timestamps, now);
  if (pruned.length < MEETING_SYNC_MAX_PER_WINDOW) {
    return 'Sync limit reached. Try again later.';
  }
  const oldest = Math.min(...pruned);
  const retryAt = oldest + MEETING_SYNC_WINDOW_MS;
  const minutesUntil = Math.max(1, Math.ceil((retryAt - now) / 60_000));
  return `Sync limit reached (2 per 30 minutes). Try again in about ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}.`;
}

export function datesToSyncTimestamps(dates: Date[] | undefined, now = Date.now()): number[] {
  if (!dates?.length) return [];
  return pruneSyncTimestamps(
    dates.map((d) => d.getTime()),
    now
  );
}

export function syncTimestampsToDates(timestamps: number[]): Date[] {
  return timestamps.map((t) => new Date(t));
}
