import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  buildProjectEntityRangeItems,
  type ProjectEntityRangeFilterOptions,
} from '@/lib/calendar/projectEntityRangeItems';
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

export function countActiveTasksForDisplayInRange(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date = new Date(),
  filterOptions: ProjectEntityRangeFilterOptions = {}
): number {
  return buildProjectEntityRangeItems(
    project,
    contentItems,
    rangeStart,
    rangeEnd,
    referenceDate,
    filterOptions
  ).openTaskCount;
}

export function countActiveContentForDisplayInRange(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date = new Date(),
  filterOptions: ProjectEntityRangeFilterOptions = {}
): number {
  return buildProjectEntityRangeItems(
    project,
    contentItems,
    rangeStart,
    rangeEnd,
    referenceDate,
    filterOptions
  ).openContentCount;
}
