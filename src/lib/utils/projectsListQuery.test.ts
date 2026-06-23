import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { buildProjectsListQuery } from '@/lib/utils/projectsListQuery';

const orgUserIds = [new Types.ObjectId(), new Types.ObjectId()];
const employee = { _id: new Types.ObjectId(), name: 'Test' };

describe('buildProjectsListQuery', () => {
  it('scopes administrators to org user ids only', () => {
    const query = buildProjectsListQuery({
      orgUserIds,
      userRole: 'Administrator',
      currentUserEmployee: employee,
    });
    expect(query).toEqual({ userId: { $in: orgUserIds } });
    expect(query).not.toHaveProperty('$or');
  });

  it('scopes managers to org user ids only', () => {
    const query = buildProjectsListQuery({
      orgUserIds,
      userRole: 'Manager',
      currentUserEmployee: employee,
    });
    expect(query).toEqual({ userId: { $in: orgUserIds } });
  });

  it('does not expose cross-org name matches for admins', () => {
    const query = buildProjectsListQuery({
      orgUserIds,
      userRole: 'Administrator',
      currentUserEmployee: { _id: new Types.ObjectId(), name: 'Test' },
    });
    const serialized = JSON.stringify(query);
    expect(serialized).not.toContain('assignedTo');
    expect(serialized).not.toContain('tasks.assignedTo');
  });

  it('requires org boundary and assignment for users', () => {
    const query = buildProjectsListQuery({
      orgUserIds,
      userRole: 'User',
      currentUserEmployee: employee,
    });
    expect(query).toHaveProperty('$and');
    const and = (query as { $and: Record<string, unknown>[] }).$and;
    expect(and[0]).toEqual({ userId: { $in: orgUserIds } });
    expect(and[1]).toHaveProperty('$or');
  });

  it('returns empty query for users without employee record', () => {
    const query = buildProjectsListQuery({
      orgUserIds,
      userRole: 'User',
      currentUserEmployee: null,
    });
    expect(query).toEqual({ _id: { $exists: false } });
  });

  it('includes status filter for admins', () => {
    const query = buildProjectsListQuery({
      orgUserIds,
      status: 'active',
      userRole: 'Administrator',
    });
    expect(query).toEqual({ userId: { $in: orgUserIds }, status: 'active' });
  });

  it('includes client-admin hubs for users on client team', () => {
    const clientId = new Types.ObjectId();
    const query = buildProjectsListQuery({
      orgUserIds,
      userRole: 'User',
      currentUserEmployee: employee,
      clientIdsForHubAccess: [clientId],
    });
    const and = (query as { $and: Record<string, unknown>[] }).$and;
    const or = (and[1] as { $or: Record<string, unknown>[] }).$or;
    expect(or).toContainEqual({
      $and: [{ projectType: 'client-admin' }, { clientId: { $in: [clientId] } }],
    });
  });
});
