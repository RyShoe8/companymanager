import type { IClient } from '@/lib/models/Client';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';
import { getCalendarPeriodTitle } from '@/lib/utils/calendarPeriodNav';
import { isClientHubProject } from '@/lib/clients/clientProjectHelpers';

type ImpactReportTask = {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  completedAt?: string;
  estimatedHours?: number;
};

type ImpactReportContent = {
  id: string;
  title: string;
  channel: string;
  projectId: string;
  projectName: string;
  publishDate?: string;
  statusPublishedAt?: string;
  estimatedHours?: number;
};

type ImpactReportMeeting = {
  id: string;
  title: string;
  start: string;
  end: string;
};

type ImpactReportProject = {
  id: string;
  name: string;
  status: string;
  category: string;
  openTaskCount: number;
};

export type ClientImpactReportData = {
  client: Pick<IClient, '_id' | 'name' | 'color' | 'logo' | 'domain'>;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    tasksCompleted: number;
    contentPublished: number;
    meetingsHeld: number;
    hoursEstimated: number;
  };
  tasks: ImpactReportTask[];
  content: ImpactReportContent[];
  meetings: ImpactReportMeeting[];
  projects: ImpactReportProject[];
};

type MeetingRow = {
  _id: { toString(): string } | string;
  title: string;
  start: Date;
  end: Date;
  linkedClientIds?: ({ toString(): string } | string)[];
};

function inRange(date: Date | undefined, start: Date, end: Date): boolean {
  if (!date) return false;
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function taskCompletedDate(task: IProjectTask): Date | undefined {
  if (task.completedAt) return new Date(task.completedAt);
  if (task.status === 'completed' && task.endDate) return new Date(task.endDate);
  return undefined;
}

function contentPublishedDate(item: Pick<IContentItem, 'statusPublishedAt' | 'publishDate' | 'status'>): Date | undefined {
  if (item.status !== 'published') return undefined;
  if (item.statusPublishedAt) return new Date(item.statusPublishedAt);
  if (item.publishDate) return new Date(item.publishDate);
  return undefined;
}

export function buildClientImpactReport(params: {
  client: Pick<IClient, '_id' | 'name' | 'color' | 'logo' | 'domain'>;
  projects: IProject[];
  contentItems: IContentItem[];
  meetings: MeetingRow[];
  timeframe: TimeframeType;
  referenceDate: Date;
}): ClientImpactReportData {
  const { client, projects, contentItems, meetings, timeframe, referenceDate } = params;
  const { start, end } = getTimeframeRange(timeframe, referenceDate);
  const clientProjectIds = new Set(projects.map((p) => String(p._id)));
  const projectNameById = new Map(projects.map((p) => [String(p._id), p.name]));

  const tasks: ImpactReportTask[] = [];
  for (const project of projects) {
    for (const task of project.tasks ?? []) {
      const completed = taskCompletedDate(task as IProjectTask);
      if (!completed || !inRange(completed, start, end)) continue;
      const rawId = (task as IProjectTask)._id;
      tasks.push({
        id: rawId ? String(rawId) : `${project._id}-${task.name}`,
        name: task.name,
        projectId: String(project._id),
        projectName: project.name,
        completedAt: completed.toISOString(),
        estimatedHours: task.estimatedHours,
      });
    }
  }

  const content: ImpactReportContent[] = [];
  for (const item of contentItems) {
    const pid = String(item.projectId);
    if (!clientProjectIds.has(pid)) continue;
    const published = contentPublishedDate(item);
    if (!published || !inRange(published, start, end)) continue;
    content.push({
      id: String(item._id),
      title: item.title,
      channel: item.channel,
      projectId: pid,
      projectName: projectNameById.get(pid) ?? 'Project',
      publishDate: item.publishDate ? new Date(item.publishDate).toISOString() : undefined,
      statusPublishedAt: item.statusPublishedAt ? new Date(item.statusPublishedAt).toISOString() : undefined,
      estimatedHours: item.estimatedHours,
    });
  }

  const clientId = String(client._id);
  const filteredMeetings: ImpactReportMeeting[] = meetings
    .filter((m) => {
      if (!inRange(new Date(m.start), start, end)) return false;
      const linked = m.linkedClientIds;
      if (!linked?.length) return false;
      return linked.some((cid) => String(cid) === clientId);
    })
    .map((m) => ({
      id: String(m._id),
      title: m.title,
      start: new Date(m.start).toISOString(),
      end: new Date(m.end).toISOString(),
    }));

  const activeProjects: ImpactReportProject[] = projects
    .filter((p) => p.status !== 'completed' && !isClientHubProject(p))
    .map((p) => ({
      id: String(p._id),
      name: p.name,
      status: p.status ?? 'planning',
      category: p.category ?? 'generic',
      openTaskCount: (p.tasks ?? []).filter((t) => t.status !== 'completed').length,
    }));

  const taskHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
  const contentHours = content.reduce((sum, c) => sum + (c.estimatedHours ?? 0), 0);

  return {
    client: {
      _id: client._id,
      name: client.name,
      color: client.color,
      logo: client.logo,
      domain: client.domain,
    },
    periodLabel: getCalendarPeriodTitle(timeframe, referenceDate),
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    summary: {
      tasksCompleted: tasks.length,
      contentPublished: content.length,
      meetingsHeld: filteredMeetings.length,
      hoursEstimated: Math.round((taskHours + contentHours) * 10) / 10,
    },
    tasks,
    content,
    meetings: filteredMeetings,
    projects: activeProjects,
  };
}
