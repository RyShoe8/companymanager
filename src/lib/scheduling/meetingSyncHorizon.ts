const MEETING_SYNC_PAST_DAYS = 30;
const MEETING_SYNC_FUTURE_MONTHS = 6;
export const MEETING_SYNC_CHUNK_DAYS = 30;
/** Drop synced rows older than this many days before now. */
const MEETING_SYNC_RETENTION_PAST_DAYS = 90;

export type DateRange = { start: Date; end: Date };

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getDesiredSyncWindow(now = new Date()): DateRange {
  const start = new Date(now);
  start.setDate(start.getDate() - MEETING_SYNC_PAST_DAYS);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setMonth(end.getMonth() + MEETING_SYNC_FUTURE_MONTHS);
  return { start, end: endOfDay(end) };
}

export function getMeetingRetentionWindow(now = new Date()): DateRange {
  const start = new Date(now);
  start.setDate(start.getDate() - MEETING_SYNC_RETENTION_PAST_DAYS);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setMonth(end.getMonth() + MEETING_SYNC_FUTURE_MONTHS + 1);
  return { start, end: endOfDay(end) };
}

/** Ranges to fetch from Google that extend beyond stored syncHorizonEnd. */
export function getSyncGapChunks(
  storedHorizonEnd: Date | null | undefined,
  desired: DateRange,
  now = new Date()
): DateRange[] {
  const desiredStart = desired.start.getTime();
  const desiredEnd = desired.end.getTime();

  let gapStartMs = desiredStart;
  if (storedHorizonEnd) {
    const horizonEndMs = storedHorizonEnd.getTime();
    if (horizonEndMs >= desiredEnd) return [];
    gapStartMs = Math.max(desiredStart, horizonEndMs + 1);
  }

  if (gapStartMs >= desiredEnd) return [];

  const chunks: DateRange[] = [];
  const chunkMs = MEETING_SYNC_CHUNK_DAYS * 24 * 60 * 60 * 1000;
  let cursor = new Date(gapStartMs);

  while (cursor.getTime() < desiredEnd) {
    const chunkEnd = new Date(Math.min(cursor.getTime() + chunkMs, desiredEnd));
    chunks.push({ start: new Date(cursor), end: chunkEnd });
    cursor = new Date(chunkEnd.getTime() + 1);
  }

  return chunks;
}

/** Initial or full backfill chunks across the desired window. */
export function getFullSyncChunks(desired: DateRange): DateRange[] {
  return getSyncGapChunks(null, desired);
}

/** Near-term refresh window (optional daily reconcile). */
function getNearTermRefreshRange(now = new Date()): DateRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 14);
  return { start, end: endOfDay(end) };
}
