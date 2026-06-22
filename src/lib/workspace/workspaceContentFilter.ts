import type { IContentItem } from '@/lib/models/ContentItem';

export function filterContentItemsForMyAssignments(
  contentItems: IContentItem[],
  currentUserEmployeeId: string,
  currentUserId: string | null | undefined
): IContentItem[] {
  return contentItems.filter(
    (item) =>
      item.assignedToEmployeeId?.toString() === currentUserEmployeeId ||
      (currentUserId != null && item.userId?.toString() === currentUserId)
  );
}
