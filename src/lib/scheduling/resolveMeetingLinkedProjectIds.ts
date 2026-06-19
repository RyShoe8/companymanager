import type { IProject } from '@/lib/models/Project';
import { activeClientProjects, clientHubProject } from '@/lib/clients/clientProjectHelpers';

/** Union explicit project links with hub + active child projects for linked clients. */
export function resolveMeetingLinkedProjectIds(
  linkedProjectIds: Array<{ toString(): string } | string>,
  linkedClientIds: Array<{ toString(): string } | string>,
  clientProjects: IProject[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (id: string) => {
    const normalized = id.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };

  for (const id of linkedProjectIds) {
    add(String(id));
  }

  for (const clientId of linkedClientIds) {
    const cid = String(clientId);
    const projectsForClient = clientProjects.filter((p) => String(p.clientId) === cid);
    const hub = clientHubProject(projectsForClient);
    if (hub) add(String(hub._id));
    for (const project of activeClientProjects(projectsForClient)) {
      add(String(project._id));
    }
  }

  return result;
}
