import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  filterContentToSeriesRepresentativesInRange,
  filterTasksToSeriesRepresentativesInRange,
} from '@/lib/recurrence/filterSeriesRepresentatives';
import {
  contentPassesAssignmentFilter,
  taskPassesAssignmentFilter,
} from '@/lib/utils/assigneeDisplay';
import { resolveTaskDisplayDates, taskInDisplayRange } from '@/lib/utils/dateUtils';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';
import {
  isActiveWorkspaceContent,
  isActiveWorkspaceTask,
} from '@/lib/workspace/activeWorkspaceItems';
import { passesTeamFilter } from '@/lib/workspace/teamFilter';
import type { TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';
import type { MergedCalendarItem } from '@/lib/calendar/mergedCalendarItems';

export type EntityRangeMergedItem =
  | { type: 'task'; task: IProjectTask; date: Date }
  | { type: 'content'; content: IContentItem };

export type EntityRangeTaskItem = {
  task: IProjectTask;
  startDate: Date;
  endDate: Date;
};

export type ProjectEntityRangeFilterOptions = {
  contentChannelFilter?: string;
  teamFilter?: TeamFilterType;
  employees?: Parameters<typeof passesTeamFilter>[2];
  showOnlyMyAssignments?: boolean;
  isManagerOrAdmin?: boolean;
  currentUserEmployeeId?: string | null;
  currentUserEmployeeName?: string | null;
  currentUserRole?: 'Administrator' | 'Manager' | 'User';
};

export type ProjectEntityRangeActivityOptions = {
  getTaskActivityMs?: (project: IProject, task: IProjectTask, taskIndex: number) => number;
  getContentActivityMs?: (item: IContentItem) => number;
  resolveTaskIndex?: (project: IProject, task: IProjectTask) => number;
};

function assignmentFilterOpts(options: ProjectEntityRangeFilterOptions) {
  return {
    showOnlyMyAssignments: options.showOnlyMyAssignments ?? false,
    isManagerOrAdmin: options.isManagerOrAdmin ?? false,
    currentUserEmployeeId: options.currentUserEmployeeId ?? null,
    currentUserEmployeeName: options.currentUserEmployeeName ?? null,
    currentUserRole: options.currentUserRole,
  };
}

function taskPassesEntityFilters(
  task: IProjectTask,
  options: ProjectEntityRangeFilterOptions
): boolean {
  if (options.teamFilter && options.teamFilter !== 'All Teams') {
    if (!passesTeamFilter(task, options.teamFilter, options.employees ?? [])) return false;
  }
  if (options.showOnlyMyAssignments) {
    if (!options.currentUserEmployeeName && !options.currentUserEmployeeId) return true;
    return taskPassesAssignmentFilter(task, assignmentFilterOpts(options));
  }
  if (options.isManagerOrAdmin) return true;
  if (options.currentUserEmployeeName || options.currentUserEmployeeId) {
    return taskPassesAssignmentFilter(task, assignmentFilterOpts(options));
  }
  return true;
}

function contentPassesEntityFilters(
  item: IContentItem,
  options: ProjectEntityRangeFilterOptions
): boolean {
  if (
    options.contentChannelFilter &&
    options.contentChannelFilter !== 'All' &&
    item.channel !== options.contentChannelFilter
  ) {
    return false;
  }
  if (options.teamFilter && options.teamFilter !== 'All Teams') {
    if (!passesTeamFilter(item, options.teamFilter, options.employees ?? [])) return false;
  }
  return contentPassesAssignmentFilter(item, assignmentFilterOpts(options));
}

function isActiveEntityRangeItem(item: EntityRangeMergedItem): boolean {
  return item.type === 'task'
    ? isActiveWorkspaceTask(item.task)
    : isActiveWorkspaceContent(item.content);
}

export function buildProjectEntityRangeItems(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date,
  filterOptions: ProjectEntityRangeFilterOptions = {},
  activityOptions: ProjectEntityRangeActivityOptions = {}
): {
  displayList: EntityRangeMergedItem[];
  openTaskCount: number;
  openContentCount: number;
  taskItems: EntityRangeTaskItem[];
  contentInRange: IContentItem[];
  merged: EntityRangeMergedItem[];
} {
  const projectIdStr = project._id.toString();
  const resolveTaskIndex = activityOptions.resolveTaskIndex ?? resolveTaskIndexInProject;
  const getTaskActivityMs = activityOptions.getTaskActivityMs ?? (() => 0);
  const getContentActivityMs = activityOptions.getContentActivityMs ?? (() => 0);

  const displayTasks = project.tasks
    ? filterTasksToSeriesRepresentativesInRange(project.tasks, rangeStart, rangeEnd, {
        mode: 'active',
        referenceDate,
      })
    : [];

  const projectContent = contentItems.filter(
    (item) => item.projectId?.toString() === projectIdStr
  );
  const displayContent = filterContentToSeriesRepresentativesInRange(
    projectContent,
    rangeStart,
    rangeEnd,
    { mode: 'active', referenceDate }
  );

  const taskItems: EntityRangeTaskItem[] = [];
  for (const task of displayTasks) {
    if (!taskPassesEntityFilters(task, filterOptions)) continue;
    const resolved = resolveTaskDisplayDates(task, rangeEnd);
    if (!resolved) continue;
    taskItems.push({ task, startDate: resolved.startDate, endDate: resolved.endDate });
  }

  const contentInRange = displayContent.filter((item) =>
    contentPassesEntityFilters(item, filterOptions)
  );

  const merged: EntityRangeMergedItem[] = [];
  for (const { task, startDate } of taskItems) {
    merged.push({ type: 'task', task, date: startDate });
  }
  for (const content of contentInRange) {
    merged.push({ type: 'content', content });
  }

  merged.sort((a, b) => {
    const aDone = a.type === 'task' && a.task.status === 'completed';
    const bDone = b.type === 'task' && b.task.status === 'completed';
    if (aDone !== bDone) return aDone ? 1 : -1;
    const activityA =
      a.type === 'task'
        ? getTaskActivityMs(project, a.task, resolveTaskIndex(project, a.task))
        : getContentActivityMs(a.content);
    const activityB =
      b.type === 'task'
        ? getTaskActivityMs(project, b.task, resolveTaskIndex(project, b.task))
        : getContentActivityMs(b.content);
    if (activityA !== activityB) return activityB - activityA;
    return a.type === 'task' ? -1 : 1;
  });

  const displayList = merged.filter(
    (item) =>
      isActiveEntityRangeItem(item) &&
      (item.type === 'content'
        ? contentPassesEntityFilters(item.content, filterOptions)
        : taskPassesEntityFilters(item.task, filterOptions))
  );

  const openTaskCount = taskItems.filter((item) => item.task.status !== 'completed').length;
  const openContentCount = contentInRange.filter((item) => item.status !== 'published').length;

  return {
    displayList,
    openTaskCount,
    openContentCount,
    taskItems,
    contentInRange,
    merged,
  };
}

/** Active tasks/content for client card expansion (uses displayList from range builder). */
export function buildClientProjectDisplayList(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date
): MergedCalendarItem[] {
  const { displayList } = buildProjectEntityRangeItems(
    project,
    contentItems,
    rangeStart,
    rangeEnd,
    referenceDate
  );
  return displayList as MergedCalendarItem[];
}

/** Fallback when series filtering omits an active task that still belongs in range. */
export function fallbackActiveTasksForClientExpand(
  project: IProject,
  rangeStart: Date,
  rangeEnd: Date
): MergedCalendarItem[] {
  const items: MergedCalendarItem[] = [];
  for (const task of project.tasks ?? []) {
    if (!isActiveWorkspaceTask(task)) continue;
    if (!taskInDisplayRange(task, rangeStart, rangeEnd)) continue;
    const resolved = resolveTaskDisplayDates(task, rangeEnd);
    if (!resolved) continue;
    items.push({ type: 'task', task, date: resolved.startDate });
  }
  return items;
}
