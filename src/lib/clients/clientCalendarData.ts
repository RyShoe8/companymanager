import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { getTimeframeRange, taskOverlapsViewRange, parseDateSafe, type TimeframeType } from '@/lib/utils/dateUtils';
import { activeClientProjects, isClientHubProject } from '@/lib/clients/clientProjectHelpers';
import { isActiveWorkspaceContent, isActiveWorkspaceTask } from '@/lib/workspace/activeWorkspaceItems';
import { sumContentHoursInTimeframe, sumTaskHoursInTimeframe } from '@/lib/utils/projectHours';

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

function projectProgressPercent(project: IProject): number {
  const totalTasks = project.tasks?.length ?? 0;
  if (totalTasks === 0) return 0;
  const completedTasks = project.tasks?.filter((t) => t.status === 'completed').length ?? 0;
  return Math.round((completedTasks / totalTasks) * 100);
}

function countActiveTasks(project: IProject): number {
  return (project.tasks ?? []).filter((task) => isActiveWorkspaceTask(task)).length;
}

function countActiveContentForProject(projectId: string, contentItems: IContentItem[]): number {
  return contentItems.filter(
    (item) => String(item.projectId) === projectId && isActiveWorkspaceContent(item)
  ).length;
}

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

export function buildClientCalendarRows(
  clients: IClient[],
  allProjects: IProject[],
  contentItems: IContentItem[],
  timeframe: TimeframeType,
  currentDate: Date,
  options?: {
    showTasks?: boolean;
    showContent?: boolean;
  }
): ClientCalendarRow[] {
  const showTasks = options?.showTasks !== false;
  const showContent = options?.showContent !== false;
  const { start, end } = getTimeframeRange(timeframe, currentDate);

  return clients.map((client) => {
    const clientId = String(client._id);
    const clientProjects = projectsForClient(clientId, allProjects);
    const projectIds = clientProjects.map((p) => String(p._id));

    let activeTaskCount = 0;
    let tasksInRange = 0;
    for (const project of clientProjects) {
      for (const task of project.tasks ?? []) {
        if (!isActiveWorkspaceTask(task)) continue;
        activeTaskCount += 1;
        if (showTasks) {
          const taskStart = parseDateSafe(task.startDate);
          const taskEnd = parseDateSafe(task.endDate);
          if (taskStart && taskEnd && taskOverlapsViewRange(start, end, taskStart, taskEnd)) {
            tasksInRange += 1;
          }
        }
      }
    }

    let activeContentCount = 0;
    let contentInRange = 0;
    for (const item of contentItems) {
      if (!projectIds.includes(String(item.projectId))) continue;
      if (!isActiveWorkspaceContent(item)) continue;
      activeContentCount += 1;
      if (showContent) {
        const pub = item.publishDate ? new Date(item.publishDate) : null;
        if (pub && pub >= start && pub <= end) {
          contentInRange += 1;
        }
      }
    }

    const hasActivityInRange = tasksInRange > 0 || contentInRange > 0;

    let scheduledHours = 0;
    let completedTasks = 0;
    let totalTasks = 0;
    for (const project of clientProjects) {
      scheduledHours += scheduledHoursForProject(project, contentItems, timeframe, { start, end });
      for (const task of project.tasks ?? []) {
        totalTasks += 1;
        if (task.status === 'completed') completedTasks += 1;
      }
    }
    scheduledHours = Math.round(scheduledHours * 100) / 100;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const projects: ClientCalendarProjectRow[] = activeClientProjects(clientProjects).map((project) => ({
      project,
      activeTaskCount: countActiveTasks(project),
      activeContentCount: countActiveContentForProject(String(project._id), contentItems),
      progressPercent: projectProgressPercent(project),
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

export function sortClientRowsByActivity(rows: ClientCalendarRow[]): ClientCalendarRow[] {
  return [...rows].sort((a, b) => {
    const aScore = a.tasksInRange + a.contentInRange;
    const bScore = b.tasksInRange + b.contentInRange;
    if (bScore !== aScore) return bScore - aScore;
    return (a.client.name ?? '').localeCompare(b.client.name ?? '');
  });
}

export function nonHubProjectsForClient(clientId: string, projects: IProject[]): IProject[] {
  return projectsForClient(clientId, projects).filter((p) => !isClientHubProject(p));
}
