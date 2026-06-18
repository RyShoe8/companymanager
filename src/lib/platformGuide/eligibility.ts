const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function isRestartGuideVisible(
  createdAt: string | Date | null | undefined,
  now = Date.now()
): boolean {
  if (!createdAt) return false;
  const ms = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
  if (Number.isNaN(ms)) return false;
  return now - ms <= THIRTY_DAYS_MS;
}

export function shouldAutoStart(platformGuideCompletedAt: string | null | undefined): boolean {
  return !platformGuideCompletedAt;
}
