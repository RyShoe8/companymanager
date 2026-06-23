import type { IContentItem } from '@/lib/models/ContentItem';
import type { IProjectTask } from '@/lib/models/Project';
import {
  isActiveWorkspaceContent,
  isActiveWorkspaceTask,
} from '@/lib/workspace/activeWorkspaceItems';

export type MergedCalendarItem =
  | { type: 'task'; task: IProjectTask; date: Date }
  | { type: 'content'; content: IContentItem };

export function isActiveMergedCalendarItem(item: MergedCalendarItem): boolean {
  return item.type === 'task'
    ? isActiveWorkspaceTask(item.task)
    : isActiveWorkspaceContent(item.content);
}
