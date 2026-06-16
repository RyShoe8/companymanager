export const RETENTION_MONTHS = 6;

export function isRetentionDryRun(): boolean {
  const value = process.env.RETENTION_DRY_RUN?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function retentionCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff;
}
