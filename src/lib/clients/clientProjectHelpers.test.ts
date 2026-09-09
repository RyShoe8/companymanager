import { describe, expect, it } from 'vitest';
import {
  activeClientProjects,
  countActiveClientProjects,
  excludeClientHubProjects,
  isClientHubProject,
  mergeClientHubProjectsForAgenda,
} from '@/lib/clients/clientProjectHelpers';
import { Types } from 'mongoose';
import Client from '@/lib/models/Client';
import Project, { type IProject } from '@/lib/models/Project';

function project(partial: Partial<IProject>): IProject {
  return new Project(partial);
}

describe('clientProjectHelpers', () => {
  const clientId = new Types.ObjectId();
  const otherClientId = new Types.ObjectId();
  const projectIds = Array.from({ length: 4 }, () => new Types.ObjectId());
  it('isClientHubProject identifies client-admin', () => {
    expect(isClientHubProject({ projectType: 'client-admin' })).toBe(true);
    expect(isClientHubProject({ projectType: 'client' })).toBe(false);
  });

  it('countActiveClientProjects excludes hub and completed', () => {
    const projects = [
      project({ _id: projectIds[0], clientId, projectType: 'client-admin', status: 'planning' }),
      project({ _id: projectIds[1], clientId, projectType: 'client', status: 'planning' }),
      project({ _id: projectIds[2], clientId, projectType: 'client', status: 'completed' }),
      project({ _id: projectIds[3], clientId: otherClientId, projectType: 'client', status: 'planning' }),
    ];
    expect(countActiveClientProjects(projects, String(clientId))).toBe(1);
  });

  it('activeClientProjects filters hub and completed', () => {
    const projects = [
      project({ _id: projectIds[0], projectType: 'client-admin', status: 'planning' }),
      project({ _id: projectIds[1], projectType: 'client', status: 'in-development' }),
    ];
    expect(activeClientProjects(projects).map((p) => p._id)).toEqual([projectIds[1]]);
  });

  it('excludeClientHubProjects removes client-admin only', () => {
    const projects = [
      project({ _id: projectIds[0], projectType: 'client-admin', name: 'Acme HQ' }),
      project({ _id: projectIds[1], projectType: 'client', name: 'Acme Website' }),
      project({ _id: projectIds[2], projectType: 'internal', name: 'Internal' }),
    ];
    expect(excludeClientHubProjects(projects).map((p) => p._id)).toEqual([projectIds[1], projectIds[2]]);
  });

  it('mergeClientHubProjectsForAgenda appends hubs for visible clients only', () => {
    const clients = [new Client({ _id: clientId, name: 'Acme' })];
    const base = [
      project({ _id: projectIds[1], projectType: 'client', clientId, name: 'Acme Website' }),
    ];
    const allProjects = [
      project({ _id: projectIds[0], projectType: 'client-admin', clientId, name: 'Acme' }),
      project({ _id: projectIds[1], projectType: 'client', clientId, name: 'Acme Website' }),
      project({ _id: projectIds[2], projectType: 'client-admin', clientId: otherClientId, name: 'Other HQ' }),
    ];
    const merged = mergeClientHubProjectsForAgenda(base, allProjects, clients);
    expect(merged.map((p) => p._id)).toEqual([projectIds[1], projectIds[0]]);
  });

  it('mergeClientHubProjectsForAgenda dedupes hubs already in base', () => {
    const clients = [new Client({ _id: clientId, name: 'Acme' })];
    const hub = project({ _id: projectIds[0], projectType: 'client-admin', clientId, name: 'Acme' });
    const merged = mergeClientHubProjectsForAgenda([hub], [hub], clients);
    expect(merged).toHaveLength(1);
  });
});
