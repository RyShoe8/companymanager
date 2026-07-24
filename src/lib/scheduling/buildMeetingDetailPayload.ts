import type {
  IProject,
  IProjectActionButton,
  IProjectMarketingStackItem,
  IProjectSocialLink,
  IProjectTechStackItem,
} from '@/lib/models/Project';
import type { IClient } from '@/lib/models/Client';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';
import {
  buildMeetingAgenda,
  type AgendaContentItem,
  type AgendaProjectBlock,
  type AgendaTaskItem,
  type MeetingAgendaPayload,
} from '@/lib/scheduling/buildMeetingAgenda';
import { isClientHubProject } from '@/lib/clients/clientProjectHelpers';
import { getProjectWorkspaceHref } from '@/lib/scheduling/getProjectWorkspaceHref';
import type { BackendProjectStatus } from '@/lib/utils/statusMapping';

type ProjectAssetRow = {
  _id: { toString(): string };
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
  linkedProjectId?: { toString(): string };
  linkedProjectTaskId?: { toString(): string };
  linkedContentItemId?: { toString(): string };
};

export type MeetingDetailAsset = {
  id: string;
  name: string;
  type: string;
  href: string;
  openMode: 'external' | 'popout';
};

type MeetingDetailActionButton = {
  label: string;
  url: string;
  kind?: IProjectActionButton['kind'];
};

export type MeetingDetailProjectResources = {
  devUrl?: string;
  liveUrl?: string;
  urls: string[];
  status: string;
  workspaceHref: string;
  assetsHref: string;
  actionButtons: MeetingDetailActionButton[];
  socialLinks: IProjectSocialLink[];
  colorPalette: string[];
  fontPalette: string[];
  projectColor?: string;
  techStack: IProjectTechStackItem[];
  marketingStack: IProjectMarketingStackItem[];
  projectType?: string;
  category?: string;
  description?: string;
};

export type MeetingDetailTaskItem = AgendaTaskItem & {
  assets: MeetingDetailAsset[];
};

export type MeetingDetailContentItem = AgendaContentItem & {
  assets: MeetingDetailAsset[];
};

type MeetingDetailProjectBlock = Omit<AgendaProjectBlock, 'tasks' | 'contentItems'> & {
  resources: MeetingDetailProjectResources;
  assets: MeetingDetailAsset[];
  tasks: MeetingDetailTaskItem[];
  contentItems: MeetingDetailContentItem[];
};

export type MeetingDetailInvitees = {
  employees: { id: string; name: string }[];
  externalEmails: string[];
};

export type MeetingDetailPayload = {
  meeting: MeetingAgendaPayload['meeting'] & {
    joinUrl?: string;
    joinPlatform?: MeetingJoinPlatform;
  };
  invitees: MeetingDetailInvitees;
  projects: MeetingDetailProjectBlock[];
};

function isExternalAssetUrl(url?: string): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed);
}

function mapAsset(asset: ProjectAssetRow): MeetingDetailAsset {
  const id = asset._id.toString();
  const externalUrl = asset.url?.trim();
  if (externalUrl && isExternalAssetUrl(externalUrl)) {
    return {
      id,
      name: asset.name,
      type: asset.type,
      href: externalUrl,
      openMode: 'external',
    };
  }
  return {
    id,
    name: asset.name,
    type: asset.type,
    href: `/assets/view/${id}?popout=1`,
    openMode: 'popout',
  };
}

function mapActionButtons(buttons: IProjectActionButton[] | undefined): MeetingDetailActionButton[] {
  return (buttons || []).map((b) => ({
    label: b.label,
    url: b.url,
    kind: b.kind,
  }));
}

function mapProjectResources(
  project: IProject,
  pid: string,
  client?: IClient
): MeetingDetailProjectResources {
  const status = (project.status || 'planning') as BackendProjectStatus;
  const urls = project.urls?.length
    ? project.urls
    : project.url
      ? [project.url]
      : client?.urls?.length
        ? client.urls
        : client?.url
          ? [client.url]
          : [];
  return {
    devUrl: project.devUrl || client?.devUrl,
    liveUrl: project.liveUrl || client?.liveUrl,
    urls,
    status,
    workspaceHref: getProjectWorkspaceHref(pid, status),
    assetsHref: `/assets?projectId=${pid}`,
    actionButtons: mapActionButtons(project.actionButtons?.length ? project.actionButtons : client?.actionButtons),
    socialLinks: project.socialLinks?.length ? project.socialLinks : client?.socialLinks ?? [],
    colorPalette: project.colorPalette ?? [],
    fontPalette: project.fontPalette ?? [],
    projectColor: project.color,
    techStack: project.techStack?.length ? project.techStack : client?.techStack ?? [],
    marketingStack: project.marketingStack?.length ? project.marketingStack : client?.marketingStack ?? [],
    projectType: project.projectType,
    category: project.category,
    description: project.description,
  };
}

function isProjectLevelAsset(asset: ProjectAssetRow): boolean {
  return !asset.linkedProjectTaskId && !asset.linkedContentItemId;
}

export function buildMeetingDetailPayload(
  meeting: {
    title: string;
    start: Date;
    end: Date;
    agendaUrl: string;
    joinUrl?: string;
    joinPlatform?: MeetingJoinPlatform;
  },
  projects: IProject[],
  assetsByProjectId: Map<string, ProjectAssetRow[]>,
  contentItems: IContentItem[] = [],
  invitees: MeetingDetailInvitees = { employees: [], externalEmails: [] },
  clients: IClient[] = []
): MeetingDetailPayload {
  const agenda = buildMeetingAgenda(meeting, projects, contentItems);
  const projectById = new Map(projects.map((p) => [p._id.toString(), p]));
  const clientById = new Map(clients.map((c) => [c._id.toString(), c]));
  const clientByHubProjectId = new Map<string, IClient>();
  for (const project of projects) {
    if (!isClientHubProject(project) || !project.clientId) continue;
    const client = clientById.get(project.clientId.toString());
    if (client) clientByHubProjectId.set(project._id.toString(), client);
  }

  const projectsWithResources: MeetingDetailProjectBlock[] = agenda.projects.map((block) => {
    const project = projectById.get(block.projectId);
    const pid = block.projectId;
    const projectAssets = assetsByProjectId.get(pid) || [];

    const assetsByTaskId = new Map<string, MeetingDetailAsset[]>();
    const assetsByContentId = new Map<string, MeetingDetailAsset[]>();
    const projectLevelAssets: MeetingDetailAsset[] = [];

    for (const asset of projectAssets) {
      const mapped = mapAsset(asset);
      const taskId = asset.linkedProjectTaskId?.toString();
      const contentId = asset.linkedContentItemId?.toString();
      if (taskId) {
        const list = assetsByTaskId.get(taskId) || [];
        list.push(mapped);
        assetsByTaskId.set(taskId, list);
      } else if (contentId) {
        const list = assetsByContentId.get(contentId) || [];
        list.push(mapped);
        assetsByContentId.set(contentId, list);
      } else if (isProjectLevelAsset(asset)) {
        projectLevelAssets.push(mapped);
      }
    }

    const tasks: MeetingDetailTaskItem[] = block.tasks.map((task) => ({
      ...task,
      assets: assetsByTaskId.get(task.taskId) || [],
    }));

    const contentItemsWithAssets: MeetingDetailContentItem[] = block.contentItems.map((item) => ({
      ...item,
      assets: assetsByContentId.get(item.contentItemId) || [],
    }));

    return {
      projectId: block.projectId,
      name: block.name,
      color: block.color,
      tasks,
      contentItems: contentItemsWithAssets,
      resources: project
        ? mapProjectResources(project, pid, clientByHubProjectId.get(pid))
        : {
            urls: [],
            status: 'planning',
            workspaceHref: getProjectWorkspaceHref(pid, 'planning'),
            assetsHref: `/assets?projectId=${pid}`,
            actionButtons: [],
            socialLinks: [],
            colorPalette: [],
            fontPalette: [],
            techStack: [],
            marketingStack: [],
          },
      assets: projectLevelAssets,
    };
  });

  for (const project of projects) {
    const pid = project._id.toString();
    if (projectsWithResources.some((b) => b.projectId === pid)) continue;
    const projectAssets = (assetsByProjectId.get(pid) || []).filter(isProjectLevelAsset);
    projectsWithResources.push({
      projectId: pid,
      name: project.name,
      color: project.color,
      tasks: [],
      contentItems: [],
      resources: mapProjectResources(project, pid, clientByHubProjectId.get(pid)),
      assets: projectAssets.map(mapAsset),
    });
  }

  return {
    meeting: {
      ...agenda.meeting,
      joinUrl: meeting.joinUrl,
      joinPlatform: meeting.joinPlatform,
    },
    invitees,
    projects: projectsWithResources,
  };
}
