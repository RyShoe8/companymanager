import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IEmployee } from '@/lib/models/Employee';
import {
  parseDateSafe,
  publishDateOnViewDay,
  taskOverlapsViewDay,
  taskOverlapsViewRange,
  localCalendarDayIndex,
  taskCalendarDayIndex,
} from '@/lib/utils/dateUtils';
import {
  filterContentToSeriesRepresentativesInRange,
  filterTasksToSeriesRepresentativesInRange,
} from '@/lib/recurrence/filterSeriesRepresentatives';
import {
  contentPassesAssignmentFilter,
  taskPassesAssignmentFilter,
} from '@/lib/utils/assigneeDisplay';
import { passesTeamFilter } from '@/lib/workspace/teamFilter';
import {
  isActiveWorkspaceContent,
  isActiveWorkspaceTask,
} from '@/lib/workspace/activeWorkspaceItems';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';
import type { TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';
export function calendarDayKey(day: Date): string {
  return day.toDateString();
}

export type CalendarItemEntry =
  | {
      type: 'task';
      project: IProject;
      task: IProjectTask;
      day: Date;
      startDate: Date;
      endDate: Date;
    }
  | {
      type: 'content';
      project: IProject;
      content: IContentItem;
      day: Date;
    };

export type CalendarItemModeOptions = {
  showTasks: boolean;
  showContent: boolean;
  referenceDate: Date;
  contentChannelFilter?: string;
  teamFilter?: TeamFilterType;
  employees?: IEmployee[];
  showOnlyMyAssignments?: boolean;
  isManagerOrAdmin?: boolean;
  currentUserEmployeeId?: string | null;
  currentUserEmployeeName?: string | null;
  projectFilter?: (project: IProject) => boolean;
  getTaskActivityMs?: (project: IProject, task: IProjectTask) => number;
  getContentActivityMs?: (content: IContentItem) => number;
};

function assignmentOpts(options: CalendarItemModeOptions) {
  return {
    showOnlyMyAssignments: options.showOnlyMyAssignments ?? false,
    isManagerOrAdmin: options.isManagerOrAdmin ?? false,
    currentUserEmployeeId: options.currentUserEmployeeId ?? null,
    currentUserEmployeeName: options.currentUserEmployeeName ?? null,
  };
}

function taskPassesFilters(
  project: IProject,
  task: IProjectTask,
  options: CalendarItemModeOptions
): boolean {
  if (!isActiveWorkspaceTask(task)) return false;
  if (options.teamFilter && options.teamFilter !== 'All Teams') {
    if (!passesTeamFilter(task, options.teamFilter, options.employees ?? [])) return false;
  }
  return taskPassesAssignmentFilter(task, assignmentOpts(options));
}

function contentPassesFilters(item: IContentItem, options: CalendarItemModeOptions): boolean {
  if (!isActiveWorkspaceContent(item)) return false;
  if (options.contentChannelFilter && options.contentChannelFilter !== 'All') {
    if (item.channel !== options.contentChannelFilter) return false;
  }
  if (options.teamFilter && options.teamFilter !== 'All Teams') {
    if (!passesTeamFilter(item, options.teamFilter, options.employees ?? [])) return false;
  }
  return contentPassesAssignmentFilter(item, assignmentOpts(options));
}

function compareEntries(
  a: CalendarItemEntry,
  b: CalendarItemEntry,
  options: CalendarItemModeOptions
): number {
  const aDone = a.type === 'task' && a.task.status === 'completed';
  const bDone = b.type === 'task' && b.task.status === 'completed';
  if (aDone !== bDone) return aDone ? 1 : -1;

  const activityA =
    a.type === 'task'
      ? (options.getTaskActivityMs?.(a.project, a.task) ?? 0)
      : (options.getContentActivityMs?.(a.content) ?? 0);
  const activityB =
    b.type === 'task'
      ? (options.getTaskActivityMs?.(b.project, b.task) ?? 0)
      : (options.getContentActivityMs?.(b.content) ?? 0);
  if (activityA !== activityB) return activityB - activityA;
  return a.type === 'task' ? -1 : 1;
}

function sortEntries(items: CalendarItemEntry[], options: CalendarItemModeOptions): CalendarItemEntry[] {
  return [...items].sort((a, b) => compareEntries(a, b, options));
}

export function collectCalendarItemsForDay(
  day: Date,
  projects: IProject[],
  contentItems: IContentItem[],
  options: CalendarItemModeOptions
): CalendarItemEntry[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const entries: CalendarItemEntry[] = [];

  for (const project of projects) {
    if (options.projectFilter && !options.projectFilter(project)) continue;
    const projectIdStr = project._id.toString();

    if (options.showTasks && project.tasks) {
      const displayTasks = filterTasksToSeriesRepresentativesInRange(
        project.tasks,
        dayStart,
        dayEnd,
        {
          mode: 'active',
          referenceDate: options.referenceDate,
        }
      );
      for (const task of displayTasks) {
        if (!taskPassesFilters(project, task, options)) continue;
        const taskStart = parseDateSafe(task.startDate);
        const taskEnd = parseDateSafe(task.endDate);
        if (!taskStart || !taskEnd) continue;
        if (!taskOverlapsViewDay(dayStart, taskStart, taskEnd)) continue;
        entries.push({
          type: 'task',
          project,
          task,
          day: dayStart,
          startDate: taskStart,
          endDate: taskEnd,
        });
      }
    }

    if (options.showContent) {
      const projectContent = contentItems.filter(
        (item) => item.projectId?.toString() === projectIdStr
      );
      const displayContent = filterContentToSeriesRepresentativesInRange(
        projectContent,
        dayStart,
        dayEnd,
        {
          mode: 'active',
          referenceDate: options.referenceDate,
        }
      );
      for (const item of displayContent) {
        if (!contentPassesFilters(item, options)) continue;
        if (!item.publishDate) continue;
        const publishDate = parseDateSafe(item.publishDate);
        if (!publishDate) continue;
        if (!publishDateOnViewDay(dayStart, publishDate)) continue;
        entries.push({
          type: 'content',
          project,
          content: item,
          day: dayStart,
        });
      }
    }
  }

  return sortEntries(entries, options);
}

export function collectCalendarItemsForRange(
  rangeStart: Date,
  rangeEnd: Date,
  projects: IProject[],
  contentItems: IContentItem[],
  options: CalendarItemModeOptions
): CalendarItemEntry[] {
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(23, 59, 59, 999);

  const entries: CalendarItemEntry[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dayItems = collectCalendarItemsForDay(current, projects, contentItems, options);
    entries.push(...dayItems);
    current.setDate(current.getDate() + 1);
  }

  return entries;
}

export function bucketItemsByDay(
  items: CalendarItemEntry[],
  days: Date[]
): Map<string, CalendarItemEntry[]> {
  const map = new Map<string, CalendarItemEntry[]>();
  for (const day of days) {
    map.set(calendarDayKey(day), []);
  }
  for (const item of items) {
    const key = calendarDayKey(item.day);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

export function dedupeRangeItems(items: CalendarItemEntry[]): CalendarItemEntry[] {
  const seen = new Set<string>();
  const result: CalendarItemEntry[] = [];
  for (const item of items) {
    const key =
      item.type === 'task'
        ? `task:${item.project._id}:${item.task._id?.toString() ?? item.task.name}:${calendarDayKey(item.day)}`
        : `content:${item.content._id}:${calendarDayKey(item.day)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function sortFlatRangeItems(
  items: CalendarItemEntry[],
  options: CalendarItemModeOptions
): CalendarItemEntry[] {
  return sortEntries(dedupeRangeItems(items), options);
}

export type CalendarSpanItem =
  | {
      type: 'task';
      project: IProject;
      task: IProjectTask;
      startDate: Date;
      endDate: Date;
    }
  | {
      type: 'content';
      project: IProject;
      content: IContentItem;
      startDate: Date;
      endDate: Date;
    };

export type WeekSpanLayout = {
  item: CalendarSpanItem;
  startCol: number;
  span: number;
  displayStart: Date;
  displayEnd: Date;
  top: number;
  height: number;
};

export function collectUniqueSpanItemsForRange(
  rangeStart: Date,
  rangeEnd: Date,
  projects: IProject[],
  contentItems: IContentItem[],
  options: CalendarItemModeOptions
): CalendarSpanItem[] {
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(23, 59, 59, 999);
  const items: CalendarSpanItem[] = [];

  for (const project of projects) {
    if (options.projectFilter && !options.projectFilter(project)) continue;
    const projectIdStr = project._id.toString();

    if (options.showTasks && project.tasks) {
      const displayTasks = filterTasksToSeriesRepresentativesInRange(
        project.tasks,
        start,
        end,
        {
          mode: 'active',
          referenceDate: options.referenceDate,
        }
      );
      for (const task of displayTasks) {
        if (!taskPassesFilters(project, task, options)) continue;
        const taskStart = parseDateSafe(task.startDate);
        const taskEnd = parseDateSafe(task.endDate);
        if (!taskStart || !taskEnd) continue;
        if (!taskOverlapsViewRange(start, end, taskStart, taskEnd)) continue;
        items.push({ type: 'task', project, task, startDate: taskStart, endDate: taskEnd });
      }
    }

    if (options.showContent) {
      const projectContent = contentItems.filter(
        (item) => item.projectId?.toString() === projectIdStr
      );
      const displayContent = filterContentToSeriesRepresentativesInRange(
        projectContent,
        start,
        end,
        {
          mode: 'active',
          referenceDate: options.referenceDate,
        }
      );
      for (const item of displayContent) {
        if (!contentPassesFilters(item, options)) continue;
        if (!item.publishDate) continue;
        const publishDate = parseDateSafe(item.publishDate);
        if (!publishDate) continue;
        const v0 = localCalendarDayIndex(start);
        const v1 = localCalendarDayIndex(end);
        const t0 = taskCalendarDayIndex(publishDate);
        if (t0 < v0 || t0 > v1) continue;
        items.push({
          type: 'content',
          project,
          content: item,
          startDate: publishDate,
          endDate: publishDate,
        });
      }
    }
  }

  return items.sort((a, b) => {
    const aDone =
      (a.type === 'task' && a.task.status === 'completed') ||
      (a.type === 'content' && a.content.status === 'published');
    const bDone =
      (b.type === 'task' && b.task.status === 'completed') ||
      (b.type === 'content' && b.content.status === 'published');
    if (aDone !== bDone) return aDone ? 1 : -1;
    const activityA =
      a.type === 'task'
        ? (options.getTaskActivityMs?.(a.project, a.task) ?? 0)
        : (options.getContentActivityMs?.(a.content) ?? 0);
    const activityB =
      b.type === 'task'
        ? (options.getTaskActivityMs?.(b.project, b.task) ?? 0)
        : (options.getContentActivityMs?.(b.content) ?? 0);
    if (activityA !== activityB) return activityB - activityA;
    return a.type === 'task' ? -1 : 1;
  });
}

export function layoutWeekSpanItems(
  days: Date[],
  items: CalendarSpanItem[],
  rowHeight: number,
  baseTop = 60
): WeekSpanLayout[] {
  if (days.length === 0) return [];

  const weekStart = new Date(days[0]);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(days[days.length - 1]);
  weekEnd.setHours(23, 59, 59, 999);

  const positioned = items
    .map((item) => {
      const itemStart = item.startDate;
      const itemEnd = item.endDate;
      const displayStart = itemStart < weekStart ? weekStart : itemStart;
      const displayEnd = itemEnd > weekEnd ? weekEnd : itemEnd;

      const startCol = days.findIndex((d) => {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        return displayStart >= dayStart && displayStart <= dayEnd;
      });

      if (startCol === -1) return null;

      const startDayNormalized = new Date(displayStart);
      startDayNormalized.setHours(0, 0, 0, 0);
      const endDayNormalized = new Date(displayEnd);
      endDayNormalized.setHours(0, 0, 0, 0);
      const startDay = startDayNormalized.toDateString();
      const endDay = endDayNormalized.toDateString();
      const daysSpan =
        startDay === endDay
          ? 1
          : Math.floor(
              (endDayNormalized.getTime() - startDayNormalized.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;
      const span = Math.min(daysSpan, 7 - startCol);

      return { item, startCol, span, displayStart, displayEnd };
    })
    .filter((pos): pos is NonNullable<typeof pos> => pos !== null);

  const topPositions: number[] = new Array(positioned.length).fill(baseTop);

  for (let i = 0; i < positioned.length; i++) {
    const current = positioned[i];
    let topPosition = baseTop;
    for (let j = 0; j < i; j++) {
      const previous = positioned[j];
      if (
        current.displayStart <= previous.displayEnd &&
        current.displayEnd >= previous.displayStart
      ) {
        topPosition = Math.max(topPosition, topPositions[j] + rowHeight + 2);
      }
    }
    topPositions[i] = topPosition;
  }

  return positioned.map((pos, idx) => ({
    ...pos,
    top: topPositions[idx],
    height: rowHeight,
  }));
}

export function weekSpanGridMinHeight(layouts: WeekSpanLayout[], baseTop = 60): number {
  if (layouts.length === 0) return 600;
  const bottom = Math.max(...layouts.map((l) => l.top + l.height));
  return Math.max(600, bottom + baseTop);
}

export function spanItemToCalendarEntry(item: CalendarSpanItem, day: Date): CalendarItemEntry {
  if (item.type === 'task') {
    return {
      type: 'task',
      project: item.project,
      task: item.task,
      day,
      startDate: item.startDate,
      endDate: item.endDate,
    };
  }
  return {
    type: 'content',
    project: item.project,
    content: item.content,
    day,
  };
}

export function taskIndexForEntry(entry: CalendarItemEntry & { type: 'task' }): number {
  return resolveTaskIndexInProject(entry.project, entry.task);
}

export function contentInRangeForProject(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  options: CalendarItemModeOptions
): IContentItem[] {
  if (!options.showContent) return [];
  const projectIdStr = project._id.toString();
  const projectContent = contentItems.filter(
    (item) => item.projectId?.toString() === projectIdStr
  );
  const displayContent = filterContentToSeriesRepresentativesInRange(
    projectContent,
    rangeStart,
    rangeEnd,
    {
      mode: 'active',
      referenceDate: options.referenceDate,
    }
  );
  const v0 = localCalendarDayIndex(rangeStart);
  const v1 = localCalendarDayIndex(rangeEnd);
  return displayContent.filter((item) => {
    if (!contentPassesFilters(item, options)) return false;
    if (!item.publishDate) return true;
    const d = parseDateSafe(item.publishDate);
    if (!d) return true;
    const t0 = taskCalendarDayIndex(d);
    return t0 >= v0 && t0 <= v1;
  });
}

export function tasksInRangeForProject(
  project: IProject,
  rangeStart: Date,
  rangeEnd: Date,
  options: CalendarItemModeOptions
): Array<{ task: IProjectTask; startDate: Date; endDate: Date }> {
  if (!options.showTasks || !project.tasks) return [];
  const displayTasks = filterTasksToSeriesRepresentativesInRange(
    project.tasks,
    rangeStart,
    rangeEnd,
    {
      mode: 'active',
      referenceDate: options.referenceDate,
    }
  );
  const result: Array<{ task: IProjectTask; startDate: Date; endDate: Date }> = [];
  for (const task of displayTasks) {
    if (!taskPassesFilters(project, task, options)) continue;
    const taskStart = parseDateSafe(task.startDate);
    const taskEnd = parseDateSafe(task.endDate);
    if (!taskStart || !taskEnd) continue;
    if (!taskOverlapsViewRange(rangeStart, rangeEnd, taskStart, taskEnd)) continue;
    result.push({ task, startDate: taskStart, endDate: taskEnd });
  }
  return result;
}
