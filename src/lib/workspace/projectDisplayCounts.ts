import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  filterContentToSeriesRepresentatives,
  filterTasksToSeriesRepresentatives,
} from '@/lib/recurrence/filterSeriesRepresentatives';
import { isActiveWorkspaceContent, isActiveWorkspaceTask } from '@/lib/workspace/activeWorkspaceItems';

export function countActiveTasksForDisplay(
  project: IProject,
  referenceDate: Date = new Date()
): number {
  const tasks = (project.tasks ?? []).filter((task) => isActiveWorkspaceTask(task));
  return filterTasksToSeriesRepresentatives(tasks, { mode: 'active', referenceDate }).length;
}

export function countActiveContentForDisplay(
  projectId: string,
  contentItems: IContentItem[],
  referenceDate: Date = new Date()
): number {
  const items = contentItems.filter(
    (item) => String(item.projectId) === projectId && isActiveWorkspaceContent(item)
  );
  return filterContentToSeriesRepresentatives(items, { mode: 'active', referenceDate }).length;
}
