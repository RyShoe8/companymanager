import { describe, expect, it } from 'vitest';
import {
  activeClientProjects,
  countActiveClientProjects,
  isClientHubProject,
} from '@/lib/clients/clientProjectHelpers';
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
});
