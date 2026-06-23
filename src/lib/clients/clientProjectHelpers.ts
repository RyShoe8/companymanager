import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';

export function isClientHubProject(p: Pick<IProject, 'projectType'>): boolean {
  return p.projectType === 'client-admin';
}

export function countActiveClientProjects(projects: IProject[], clientId: string): number {
  return projects.filter(
    (p) =>
      String(p.clientId) === String(clientId) &&
      p.status !== 'completed' &&
      !isClientHubProject(p)
  ).length;
}

export function activeClientProjects(projects: IProject[]): IProject[] {
  return projects.filter((p) => p.status !== 'completed' && !isClientHubProject(p));
}

export function clientHubProject(projects: IProject[]): IProject | undefined {
  return projects.find((p) => isClientHubProject(p));
}

/** Projects visible in the Projects/Schedule lens (excludes client HQ hubs). */
export function excludeClientHubProjects(projects: IProject[]): IProject[] {
  return projects.filter((p) => !isClientHubProject(p));
}

/** Append client hub projects for agenda display (hubs stay hidden from Projects lens). */
export function mergeClientHubProjectsForAgenda(
  baseProjects: IProject[],
  allProjects: IProject[],
  clients: IClient[]
): IProject[] {
  const clientIds = new Set(clients.map((c) => String(c._id)));
  const seen = new Set(baseProjects.map((p) => String(p._id)));
  const hubs = allProjects.filter(
    (p) =>
      isClientHubProject(p) &&
      p.clientId != null &&
      clientIds.has(String(p.clientId)) &&
      !seen.has(String(p._id))
  );
  return hubs.length === 0 ? baseProjects : [...baseProjects, ...hubs];
}
