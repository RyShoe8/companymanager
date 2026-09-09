import { describe, expect, it } from 'vitest';
import { resolveClientHubProject } from '@/lib/clients/resolveClientHubProject';
import { Types } from 'mongoose';
import Project, { type IProject } from '@/lib/models/Project';

function project(partial: Partial<IProject>): IProject {
  return new Project(partial);
}

describe('resolveClientHubProject', () => {
  const clientId = new Types.ObjectId();
  it('returns client-admin project for matching clientId', () => {
    const hub = project({
      _id: new Types.ObjectId(),
      projectType: 'client-admin',
      clientId,
    });
    const other = project({
      _id: new Types.ObjectId(),
      projectType: 'client',
      clientId,
    });
    expect(resolveClientHubProject(String(clientId), [other, hub])).toBe(hub);
  });

  it('returns null when no hub exists', () => {
    const p = project({ projectType: 'client', clientId });
    expect(resolveClientHubProject(String(clientId), [p])).toBeNull();
  });
});
