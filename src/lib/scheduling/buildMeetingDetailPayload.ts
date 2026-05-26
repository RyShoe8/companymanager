import type { IProject, IProjectActionButton } from '@/lib/models/Project';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';
import {
  buildMeetingAgenda,
  type AgendaProjectBlock,
  type MeetingAgendaPayload,
} from '@/lib/scheduling/buildMeetingAgenda';
import { getProjectWorkspaceHref } from '@/lib/scheduling/getProjectWorkspaceHref';
import type { BackendProjectStatus } from '@/lib/utils/statusMapping';

const MAX_ASSETS_PER_PROJECT = 5;

type ProjectAssetRow = {
  _id: { toString(): string };
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
  linkedProjectId?: { toString(): string };
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
};

export type MeetingDetailProjectBlock = AgendaProjectBlock & {
  resources: MeetingDetailProjectResources;
  assets: MeetingDetailAsset[];
};

export type MeetingDetailPayload = {
  meeting: MeetingAgendaPayload['meeting'] & {
    joinUrl?: string;
    joinPlatform?: MeetingJoinPlatform;
  };
  projects: MeetingDetailProjectBlock[];
};

function assetHref(asset: ProjectAssetRow): string {
  if (asset.url?.trim()) return asset.url.trim();
  if (asset.fileUrl?.trim()) return asset.fileUrl.trim();
  return `/assets?projectId=${asset.linkedProjectId?.toString() ?? ''}`;
}

function mapAssets(assets: ProjectAssetRow[]): MeetingDetailAsset[] {
  return assets.slice(0, MAX_ASSETS_PER_PROJECT).map((a) => ({
    id: a._id.toString(),
    name: a.name,
    type: a.type,
    href: assetHref(a),
  }));
}

function mapActionButtons(buttons: IProjectActionButton[] | undefined): MeetingDetailActionButton[] {
  return (buttons || []).map((b) => ({
    label: b.label,
    url: b.url,
    kind: b.kind,
  }));
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
  assetsByProjectId: Map<string, ProjectAssetRow[]>
): MeetingDetailPayload {
  const agenda = buildMeetingAgenda(meeting, projects);
  const projectById = new Map(projects.map((p) => [p._id.toString(), p]));

  const projectsWithResources: MeetingDetailProjectBlock[] = agenda.projects.map((block) => {
    const project = projectById.get(block.projectId);
    const status = (project?.status || 'planning') as BackendProjectStatus;
    const pid = block.projectId;

    return {
      ...block,
      resources: {
        devUrl: project?.devUrl,
        liveUrl: project?.liveUrl,
        urls: project?.urls?.length ? project.urls : project?.url ? [project.url] : [],
        status,
        workspaceHref: getProjectWorkspaceHref(pid, status),
        assetsHref: `/assets?projectId=${pid}`,
        actionButtons: mapActionButtons(project?.actionButtons),
      },
      assets: mapAssets(assetsByProjectId.get(pid) || []),
    };
  });

  for (const project of projects) {
    const pid = project._id.toString();
    if (projectsWithResources.some((b) => b.projectId === pid)) continue;
    projectsWithResources.push({
      projectId: pid,
      name: project.name,
      color: project.color,
      tasks: [],
      resources: {
        devUrl: project.devUrl,
        liveUrl: project.liveUrl,
        urls: project.urls?.length ? project.urls : project.url ? [project.url] : [],
        status: project.status,
        workspaceHref: getProjectWorkspaceHref(pid, project.status as BackendProjectStatus),
        assetsHref: `/assets?projectId=${pid}`,
        actionButtons: mapActionButtons(project.actionButtons),
      },
      assets: mapAssets(assetsByProjectId.get(pid) || []),
    });
  }

  return {
    meeting: {
      ...agenda.meeting,
      joinUrl: meeting.joinUrl,
      joinPlatform: meeting.joinPlatform,
    },
    projects: projectsWithResources,
  };
}
