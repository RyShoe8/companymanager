import type { IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';

export function isActiveWorkspaceTask(task: IProjectTask): boolean {
  return task.status !== 'completed';
}

export function isActiveWorkspaceContent(item: IContentItem): boolean {
  return item.status !== 'published';
}
