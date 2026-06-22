type IdLike = { toString(): string } | string | null | undefined;

function idString(value: IdLike): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.toString();
}

export type ContentItemAccessFields = {
  userId?: IdLike;
  assignedToEmployeeId?: IdLike;
};

export function canAccessContentItem(params: {
  isManagerOrAdmin: boolean;
  currentUserId?: string | null;
  currentUserEmployeeId?: string | null;
  item: ContentItemAccessFields;
}): boolean {
  if (params.isManagerOrAdmin) return true;
  const creatorId = idString(params.item.userId);
  const assigneeId = idString(params.item.assignedToEmployeeId);
  const myUserId = params.currentUserId?.trim() || null;
  const myEmployeeId = params.currentUserEmployeeId?.trim() || null;
  if (myUserId && creatorId === myUserId) return true;
  if (myEmployeeId && assigneeId === myEmployeeId) return true;
  return false;
}

export function canDeleteContentItem(params: {
  isManagerOrAdmin: boolean;
  currentUserId?: string | null;
  currentUserEmployeeId?: string | null;
  item: ContentItemAccessFields;
}): boolean {
  return canAccessContentItem(params);
}
