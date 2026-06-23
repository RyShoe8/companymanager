import { describe, expect, it } from 'vitest';
import {
  activeClientProjects,
  countActiveClientProjects,
  excludeClientHubProjects,
  isClientHubProject,
  mergeClientHubProjectsForAgenda,
} from '@/lib/clients/clientProjectHelpers';
import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';

function project(partial: Partial<IProject> & { _id: string }): IProject {
  return partial as IProject;
}

describe('clientProjectHelpers', () => {
  it('isClientHubProject identifies client-admin', () => {
    expect(isClientHubProject({ projectType: 'client-admin' })).toBe(true);
    expect(isClientHubProject({ projectType: 'client' })).toBe(false);
  });

  it('countActiveClientProjects excludes hub and completed', () => {
    const projects = [
      project({ _id: '1', clientId: 'c1', projectType: 'client-admin', status: 'planning' }),
      project({ _id: '2', clientId: 'c1', projectType: 'client', status: 'planning' }),
      project({ _id: '3', clientId: 'c1', projectType: 'client', status: 'completed' }),
      project({ _id: '4', clientId: 'c2', projectType: 'client', status: 'planning' }),
    ];
    expect(countActiveClientProjects(projects, 'c1')).toBe(1);
  });

  it('activeClientProjects filters hub and completed', () => {
    const projects = [
      project({ _id: '1', projectType: 'client-admin', status: 'planning' }),
      project({ _id: '2', projectType: 'client', status: 'in-development' }),
    ];
    expect(activeClientProjects(projects).map((p) => p._id)).toEqual(['2']);
  });

  it('excludeClientHubProjects removes client-admin only', () => {
    const projects = [
      project({ _id: '1', projectType: 'client-admin', name: 'Acme HQ' }),
      project({ _id: '2', projectType: 'client', name: 'Acme Website' }),
      project({ _id: '3', projectType: 'internal', name: 'Internal' }),
    ];
    expect(excludeClientHubProjects(projects).map((p) => p._id)).toEqual(['2', '3']);
  });

  it('mergeClientHubProjectsForAgenda appends hubs for visible clients only', () => {
    const clients = [{ _id: 'c1', name: 'Acme' }] as IClient[];
    const base = [
      project({ _id: '2', projectType: 'client', clientId: 'c1', name: 'Acme Website' }),
    ];
    const allProjects = [
      project({ _id: '1', projectType: 'client-admin', clientId: 'c1', name: 'Acme' }),
      project({ _id: '2', projectType: 'client', clientId: 'c1', name: 'Acme Website' }),
      project({ _id: '3', projectType: 'client-admin', clientId: 'c2', name: 'Other HQ' }),
    ];
    const merged = mergeClientHubProjectsForAgenda(base, allProjects, clients);
    expect(merged.map((p) => p._id)).toEqual(['2', '1']);
  });

  it('mergeClientHubProjectsForAgenda dedupes hubs already in base', () => {
    const clients = [{ _id: 'c1', name: 'Acme' }] as IClient[];
    const hub = project({ _id: '1', projectType: 'client-admin', clientId: 'c1', name: 'Acme' });
    const merged = mergeClientHubProjectsForAgenda([hub], [hub], clients);
    expect(merged).toHaveLength(1);
  });
});
