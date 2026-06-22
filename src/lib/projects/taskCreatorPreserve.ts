type ObjectIdLike = { toString(): string } | string | null | undefined;

export function resolveTaskCreatedByEmployeeId(
  incoming: { createdByEmployeeId?: ObjectIdLike },
  previousTask?: { createdByEmployeeId?: ObjectIdLike }
): string | null {
  const fromIncoming = incoming.createdByEmployeeId;
  if (fromIncoming) {
    return typeof fromIncoming === 'string' ? fromIncoming : fromIncoming.toString();
  }
  const fromPrevious = previousTask?.createdByEmployeeId;
  if (!fromPrevious) return null;
  return typeof fromPrevious === 'string' ? fromPrevious : fromPrevious.toString();
}
