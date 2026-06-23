import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';
import {
  activeClientProjects,
  clientHubProject,
  isClientHubProject,
} from '@/lib/clients/clientProjectHelpers';
import { sumContentHoursInTimeframe, sumTaskHoursInTimeframe } from '@/lib/utils/projectHours';
import { projectOverlapsDateRange } from '@/lib/utils/projectCalendarOverlap';
import {
  computeClientTimeframeProgress,
  computeProjectTimeframeProgress,
} from '@/lib/calendar/timeframeProgress';
import { buildProjectEntityRangeItems } from '@/lib/calendar/projectEntityRangeItems';
import {
  buildContentItemsByProjectId,
  getProjectLatestActivityMs,
} from '@/lib/utils/projectLatestActivity';

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
  /** Client-level tasks/content on the client-admin hub (not listed in projects). */
  hubProject?: ClientCalendarProjectRow | null;
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

function projectRangeCounts(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date
): { openTaskCount: number; openContentCount: number } {
  const { openTaskCount, openContentCount } = buildProjectEntityRangeItems(
    project,
    contentItems,
    rangeStart,
    rangeEnd,
    referenceDate
  );
  return { openTaskCount, openContentCount };
}

function buildProjectRow(
  project: IProject,
  contentItems: IContentItem[],
  rangeStart: Date,
  rangeEnd: Date,
  referenceDate: Date
): ClientCalendarProjectRow {
  const { openTaskCount, openContentCount } = projectRangeCounts(
    project,
    contentItems,
    rangeStart,
    rangeEnd,
    referenceDate
  );
  return {
    project,
    activeTaskCount: openTaskCount,
    activeContentCount: openContentCount,
    progressPercent: computeProjectTimeframeProgress(
      project,
      contentItems,
      rangeStart,
      rangeEnd,
      referenceDate
    ),
  };
}

function sortClientProjectRowsByRecency(
  rows: ClientCalendarProjectRow[],
  contentItems: IContentItem[]
): ClientCalendarProjectRow[] {
  const contentByProjectId = buildContentItemsByProjectId(contentItems);
  return [...rows].sort(
    (a, b) =>
      getProjectLatestActivityMs(
        b.project,
        contentByProjectId.get(b.project._id.toString()) ?? []
      ) -
      getProjectLatestActivityMs(
        a.project,
        contentByProjectId.get(a.project._id.toString()) ?? []
      )
  );
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
    let activeContentCount = 0;
    const projects: ClientCalendarProjectRow[] = activeProjectsList.map((project) => {
      const row = buildProjectRow(project, contentItems, start, end, currentDate);
      activeTaskCount += row.activeTaskCount;
      activeContentCount += row.activeContentCount;
      return row;
    });

    const hub = clientHubProject(clientProjects);
    const hubProject =
      hub && hub.status !== 'completed'
        ? buildProjectRow(hub, contentItems, start, end, currentDate)
        : null;
    if (hubProject) {
      activeTaskCount += hubProject.activeTaskCount;
      activeContentCount += hubProject.activeContentCount;
    }

    const tasksInRange = activeTaskCount;
    const contentInRange = activeContentCount;
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

    return {
      client,
      projectIds,
      projects: sortClientProjectRowsByRecency(projects, contentItems),
      hubProject,
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
