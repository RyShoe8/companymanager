export function shouldForceActiveTaskStatus(isManagerOrAdmin: boolean): boolean {
  return !isManagerOrAdmin;
}

export function allowBulkTaskExpandForRequest(
  isManagerOrAdmin: boolean,
  allowBulkTaskExpand: unknown
): boolean {
  return isManagerOrAdmin && allowBulkTaskExpand === true;
}

export function parseIncomingTaskStatus(
  rawStatus: unknown
): 'active' | 'completed' | 'in-review' {
  if (rawStatus === undefined || rawStatus === null) return 'active';
  const statusStr = String(rawStatus).toLowerCase().trim();
  if (statusStr === 'completed' || statusStr === 'complete') return 'completed';
  if (statusStr === 'in-review' || statusStr === 'in_review') return 'in-review';
  return 'active';
}
