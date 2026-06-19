import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import {
  getTimeframeRange,
  taskOverlapsViewRange,
  parseDateSafe,
  localCalendarDayIndex,
  taskCalendarDayIndex,
  type TimeframeType,
} from '@/lib/utils/dateUtils';
import { activeClientProjects, isClientHubProject } from '@/lib/clients/clientProjectHelpers';
import { isActiveWorkspaceContent, isActiveWorkspaceTask } from '@/lib/workspace/activeWorkspaceItems';
import { sumContentHoursInTimeframe, sumTaskHoursInTimeframe } from '@/lib/utils/projectHours';
import { projectOverlapsDateRange } from '@/lib/utils/projectCalendarOverlap';
import {
  computeClientTimeframeProgress,
  computeProjectTimeframeProgress,
} from '@/lib/calendar/timeframeProgress';
import {
  countActiveContentForDisplay,
  countActiveTasksForDisplay,
} from '@/lib/workspace/projectDisplayCounts';

export type ClientCalendarProjectRow = {
  project: IProject;
  activeTaskCount: number;
  activeContentCount: number;
  progressPercent: number;
};

export type ClientCalendarRow = {
  client: IClient;
  projectIds: string[];
  projects: ClientCalendarProjectRow[];
  activeTaskCount: number;
  activeContentCount: number;
  tasksInRange: number;
  contentInRange: number;
  hasActivityInRange: boolean;
  scheduledHours: number;
  progressPercent: number;
};

function scheduledHoursForProject(
  project: IProject,
  contentItems: IContentItem[],
  timeframe: TimeframeType,
  range: { start: Date; end: Date }
): number {
  return (
    Math.round(
      (sumTaskHoursInTimeframe(project, range) +
        sumContentHoursInTimeframe(String(project._id), contentItems, timeframe, range)) *
        100
    ) / 100
  );
}

function projectsForClient(clientId: string, projects: IProject[]): IProject[] {
  return projects.filter((p) => String(p.clientId) === String(clientId));
}

function contentPublishDateInRange(
  item: IContentItem,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  if (!item.publishDate) return false;
  const d = parseDateSafe(item.publishDate);
  if (!d) return false;
  const v0 = localCalendarDayIndex(rangeStart);
  const v1 = localCalendarDayIndex(rangeEnd);
  const t0 = taskCalendarDayIndex(d);
  return t0 >= v0 && t0 <= v1;
}

export function buildClientCalendarRows(
  clients: IClient[],
  allProjects: IProject[],
  contentItems: IContentItem[],
  timeframe: TimeframeType,
  currentDate: Date
): ClientCalendarRow[] {
  const { start, end } = getTimeframeRange(timeframe, currentDate);

  return clients.map((client) => {
    const clientId = String(client._id);
    const clientProjects = projectsForClient(clientId, allProjects);
    const projectIds = clientProjects.map((p) => String(p._id));

    const activeProjectsList = activeClientProjects(clientProjects);

    let activeTaskCount = 0;
    let tasksInRange = 0;
    for (const project of activeProjectsList) {
      activeTaskCount += countActiveTasksForDisplay(project, currentDate);
      for (const task of project.tasks ?? []) {
        if (!isActiveWorkspaceTask(task)) continue;
        const taskStart = parseDateSafe(task.startDate);
        const taskEnd = parseDateSafe(task.endDate);
        if (taskStart && taskEnd && taskOverlapsViewRange(start, end, taskStart, taskEnd)) {
          tasksInRange += 1;
        }
      }
    }

    let activeContentCount = 0;
    let contentInRange = 0;
    for (const project of activeProjectsList) {
      activeContentCount += countActiveContentForDisplay(String(project._id), contentItems, currentDate);
    }
    for (const item of contentItems) {
      const pid = String(item.projectId);
      if (!activeProjectsList.some((p) => String(p._id) === pid)) continue;
      if (!isActiveWorkspaceContent(item)) continue;
      if (contentPublishDateInRange(item, start, end)) {
        contentInRange += 1;
      }
    }

    const hasActivityInRange = tasksInRange > 0 || contentInRange > 0;

    let scheduledHours = 0;
    for (const project of clientProjects) {
      scheduledHours += scheduledHoursForProject(project, contentItems, timeframe, { start, end });
    }
    scheduledHours = Math.round(scheduledHours * 100) / 100;

    const progressPercent = computeClientTimeframeProgress(
      clientProjects,
      contentItems,
      start,
      end,
      currentDate
    );

    const projects: ClientCalendarProjectRow[] = activeProjectsList.map((project) => ({
      project,
      activeTaskCount: countActiveTasksForDisplay(project, currentDate),
      activeContentCount: countActiveContentForDisplay(String(project._id), contentItems, currentDate),
      progressPercent: computeProjectTimeframeProgress(
        project,
        contentItems,
        start,
        end,
        currentDate
      ),
    }));

    return {
      client,
      projectIds,
      projects,
      activeTaskCount,
      activeContentCount,
      tasksInRange,
      contentInRange,
      hasActivityInRange,
      scheduledHours,
      progressPercent,
    };
  }).filter((row) => row.projectIds.length > 0 || row.client);
}

export { computeClientTimeframeProgress, computeProjectTimeframeProgress };

export function sortClientRowsByActivity(
  rows: ClientCalendarRow[],
  unseenCountByClientId?: Map<string, number>
): ClientCalendarRow[] {
  return [...rows].sort((a, b) => {
    if (unseenCountByClientId) {
      const aUnseen = unseenCountByClientId.get(String(a.client._id)) ?? 0;
      const bUnseen = unseenCountByClientId.get(String(b.client._id)) ?? 0;
      if (bUnseen !== aUnseen) return bUnseen - aUnseen;
    }
    const aScore = a.tasksInRange + a.contentInRange;
    const bScore = b.tasksInRange + b.contentInRange;
    if (bScore !== aScore) return bScore - aScore;
    return (a.client.name ?? '').localeCompare(b.client.name ?? '');
  });
}

export function nonHubProjectsForClient(clientId: string, projects: IProject[]): IProject[] {
  return projectsForClient(clientId, projects).filter((p) => !isClientHubProject(p));
}

/** Whether a client has any project task/content activity in a calendar bucket. */
export function clientOverlapsDateRange(
  clientProjects: IProject[],
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  if (clientProjects.length === 0) return false;
  return clientProjects.some((project) =>
    projectOverlapsDateRange(project, rangeStart, rangeEnd, contentItems)
  );
}

/** Clients with activity in [rangeStart, rangeEnd], sorted by activity then name. */
export function clientsForRange(
  rows: ClientCalendarRow[],
  rangeStart: Date,
  rangeEnd: Date,
  allProjects: IProject[],
  contentItems: IContentItem[]
): ClientCalendarRow[] {
  return rows.filter((row) => {
    const clientProjects = projectsForClient(String(row.client._id), allProjects);
    return clientOverlapsDateRange(clientProjects, contentItems, rangeStart, rangeEnd);
  });
}
