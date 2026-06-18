import { describe, expect, it } from 'vitest';
import { resolveClientHubProject } from '@/lib/clients/resolveClientHubProject';
import type { IProject } from '@/lib/models/Project';

function project(partial: Partial<IProject> & { _id: string }): IProject {
  return partial as IProject;
}

describe('resolveClientHubProject', () => {
  it('returns client-admin project for matching clientId', () => {
    const hub = project({
      _id: 'hub1',
      projectType: 'client-admin',
      clientId: 'client1',
    });
    const other = project({
      _id: 'p2',
      projectType: 'client',
      clientId: 'client1',
    });
    expect(resolveClientHubProject('client1', [other, hub])?._id).toBe('hub1');
  });

  it('returns null when no hub exists', () => {
    const p = project({ _id: 'p1', projectType: 'client', clientId: 'client1' });
    expect(resolveClientHubProject('client1', [p])).toBeNull();
  });
});
