import type {
  IProject,
  IProjectActionButton,
  IProjectMarketingStackItem,
  IProjectSocialLink,
  IProjectTechStackItem,
} from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';
import {
  buildMeetingAgenda,
  type AgendaContentItem,
  type AgendaProjectBlock,
  type AgendaTaskItem,
  type MeetingAgendaPayload,
} from '@/lib/scheduling/buildMeetingAgenda';
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
};

export type MeetingDetailActionButton = {
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

export type MeetingDetailProjectBlock = Omit<AgendaProjectBlock, 'tasks' | 'contentItems'> & {
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

function assetHref(asset: ProjectAssetRow): string {
  if (asset.url?.trim()) return asset.url.trim();
  if (asset.fileUrl?.trim()) return asset.fileUrl.trim();
  return `/assets?projectId=${asset.linkedProjectId?.toString() ?? ''}`;
}

function mapAsset(asset: ProjectAssetRow): MeetingDetailAsset {
  return {
    id: asset._id.toString(),
    name: asset.name,
    type: asset.type,
    href: assetHref(asset),
  };
}

function mapActionButtons(buttons: IProjectActionButton[] | undefined): MeetingDetailActionButton[] {
  return (buttons || []).map((b) => ({
    label: b.label,
    url: b.url,
    kind: b.kind,
  }));
}

function mapProjectResources(project: IProject, pid: string): MeetingDetailProjectResources {
  const status = (project.status || 'planning') as BackendProjectStatus;
  return {
    devUrl: project.devUrl,
    liveUrl: project.liveUrl,
    urls: project.urls?.length ? project.urls : project.url ? [project.url] : [],
    status,
    workspaceHref: getProjectWorkspaceHref(pid, status),
    assetsHref: `/assets?projectId=${pid}`,
    actionButtons: mapActionButtons(project.actionButtons),
    socialLinks: project.socialLinks ?? [],
    colorPalette: project.colorPalette ?? [],
    fontPalette: project.fontPalette ?? [],
    projectColor: project.color,
    techStack: project.techStack ?? [],
    marketingStack: project.marketingStack ?? [],
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
  invitees: MeetingDetailInvitees = { employees: [], externalEmails: [] }
): MeetingDetailPayload {
  const agenda = buildMeetingAgenda(meeting, projects, contentItems);
  const projectById = new Map(projects.map((p) => [p._id.toString(), p]));

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
        ? mapProjectResources(project, pid)
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
      resources: mapProjectResources(project, pid),
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
