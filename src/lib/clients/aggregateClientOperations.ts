import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';
import type { IAsset } from '@/lib/models/Asset';
import type {
  IProjectSocialLink,
  IProjectTechStackItem,
  IProjectMarketingStackItem,
} from '@/lib/models/platformFields';
import { clientIdStr } from '@/lib/clients/clientApiHelpers';

type PlatformSource =
  | { type: 'client' }
  | { type: 'project'; projectId: string; projectName: string };

export type AggregatedSocialLink = IProjectSocialLink & { source: PlatformSource };
export type AggregatedTechItem = IProjectTechStackItem & { source: PlatformSource };
export type AggregatedMarketingItem = IProjectMarketingStackItem & { source: PlatformSource };

export type AggregatedAsset = {
  _id?: unknown;
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
  textContent?: string;
  userId?: unknown;
  linkedProjectId?: unknown;
  linkedClientId?: unknown;
  source: PlatformSource;
};

function techKey(item: IProjectTechStackItem): string {
  return `${item.category}:${item.technologyId}`;
}

function marketingKey(item: IProjectMarketingStackItem): string {
  return `${item.category}:${item.toolId}`;
}

function socialKey(item: IProjectSocialLink): string {
  return `${item.network}:${item.url}`;
}

export function aggregateClientPlatforms(
  client: Pick<IClient, 'socialLinks' | 'techStack' | 'marketingStack'>,
  projects: IProject[]
): {
  socialLinks: AggregatedSocialLink[];
  techStack: AggregatedTechItem[];
  marketingStack: AggregatedMarketingItem[];
} {
  const socialSeen = new Set<string>();
  const techSeen = new Set<string>();
  const marketingSeen = new Set<string>();

  const socialLinks: AggregatedSocialLink[] = [];
  const techStack: AggregatedTechItem[] = [];
  const marketingStack: AggregatedMarketingItem[] = [];

  const addSocial = (items: IProjectSocialLink[] | undefined, source: PlatformSource) => {
    for (const item of items ?? []) {
      const key = socialKey(item);
      if (socialSeen.has(key)) continue;
      socialSeen.add(key);
      socialLinks.push({ ...item, source });
    }
  };
  const addTech = (items: IProjectTechStackItem[] | undefined, source: PlatformSource) => {
    for (const item of items ?? []) {
      const key = techKey(item);
      if (techSeen.has(key)) continue;
      techSeen.add(key);
      techStack.push({ ...item, source });
    }
  };
  const addMarketing = (items: IProjectMarketingStackItem[] | undefined, source: PlatformSource) => {
    for (const item of items ?? []) {
      const key = marketingKey(item);
      if (marketingSeen.has(key)) continue;
      marketingSeen.add(key);
      marketingStack.push({ ...item, source });
    }
  };

  addSocial(client.socialLinks, { type: 'client' });
  addTech(client.techStack, { type: 'client' });
  addMarketing(client.marketingStack, { type: 'client' });

  for (const project of projects) {
    const source: PlatformSource = {
      type: 'project',
      projectId: String(project._id),
      projectName: project.name,
    };
    addSocial(project.socialLinks, source);
    addTech(project.techStack, source);
    addMarketing(project.marketingStack, source);
  }

  return { socialLinks, techStack, marketingStack };
}

export function aggregateClientAssets(
  clientAssets: Array<Pick<IAsset, 'name' | 'type'> & { _id?: unknown; url?: string; fileUrl?: string; textContent?: string; userId?: unknown }>,
  projectAssets: Array<Pick<IAsset, 'name' | 'type'> & { _id?: unknown; url?: string; fileUrl?: string; textContent?: string; userId?: unknown; projectId?: string; projectName?: string }>
): AggregatedAsset[] {
  const merged: AggregatedAsset[] = clientAssets.map((a) => ({
    ...a,
    source: { type: 'client' as const },
  }));

  for (const asset of projectAssets) {
    merged.push({
      ...asset,
      source: {
        type: 'project',
        projectId: asset.projectId ?? '',
        projectName: asset.projectName ?? 'Project',
      },
    });
  }

  return merged;
}

export function projectsForClient(clientId: string, projects: IProject[]): IProject[] {
  return projects.filter((p) => clientIdStr(p.clientId as string | undefined) === clientId);
}

export function isProjectLevelAsset(asset: Pick<IAsset, 'linkedProjectTaskId' | 'linkedProjectTaskIndex' | 'linkedContentItemId'>): boolean {
  if (asset.linkedContentItemId) return false;
  if (asset.linkedProjectTaskId) return false;
  if (asset.linkedProjectTaskIndex != null) return false;
  return true;
}
