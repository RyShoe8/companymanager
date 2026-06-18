import type { IProject } from '@/lib/models/Project';

/** Resolves the client-admin hub project for a given client. */
export function resolveClientHubProject(clientId: string, projects: IProject[]): IProject | null {
  const normalized = clientId.toString();
  return (
    projects.find(
      (p) =>
        p.projectType === 'client-admin' &&
        p.clientId != null &&
        p.clientId.toString() === normalized
    ) ?? null
  );
}
