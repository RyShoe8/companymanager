import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  buildClientsListQuery,
  getClientTeamEmployeeIds,
  isEmployeeAssignedToClient,
  canUserAccessClient,
} from '@/lib/utils/clientTeam';

const orgId = new Types.ObjectId();
const employeeId = new Types.ObjectId();
const otherEmployeeId = new Types.ObjectId();

describe('buildClientsListQuery', () => {
  it('scopes administrators to organization only', () => {
    const query = buildClientsListQuery({
      organizationId: orgId,
      userRole: 'Administrator',
      currentUserEmployee: { _id: employeeId },
    });
    expect(query).toEqual({ organizationId: orgId.toString() });
    expect(query).not.toHaveProperty('$or');
  });

  it('scopes managers to organization only', () => {
    const query = buildClientsListQuery({
      organizationId: orgId,
      userRole: 'Manager',
      currentUserEmployee: { _id: employeeId },
    });
    expect(query).toEqual({ organizationId: orgId.toString() });
  });

  it('requires assignment for users', () => {
    const query = buildClientsListQuery({
      organizationId: orgId,
      userRole: 'User',
      currentUserEmployee: { _id: employeeId },
    });
    expect(query).toHaveProperty('$and');
    const and = (query as { $and: Record<string, unknown>[] }).$and;
    expect(and[0]).toEqual({ organizationId: orgId.toString() });
    expect(and[1]).toHaveProperty('$or');
  });

  it('returns empty query for users without employee record', () => {
    const query = buildClientsListQuery({
      organizationId: orgId,
      userRole: 'User',
      currentUserEmployee: null,
    });
    expect(query).toEqual({ _id: { $exists: false } });
  });
});

describe('client team helpers', () => {
  it('reads assignedToEmployeeIds and legacy single id', () => {
    const fromArray = getClientTeamEmployeeIds({
      assignedToEmployeeIds: [employeeId, otherEmployeeId],
    });
    expect(fromArray.has(employeeId.toString())).toBe(true);
    expect(fromArray.has(otherEmployeeId.toString())).toBe(true);

    const fromLegacy = getClientTeamEmployeeIds({
      assignedToEmployeeId: employeeId,
    });
    expect(fromLegacy.has(employeeId.toString())).toBe(true);
  });

  it('checks assignment and manager access', () => {
    const client = { assignedToEmployeeIds: [employeeId] };
    expect(isEmployeeAssignedToClient(client, employeeId)).toBe(true);
    expect(isEmployeeAssignedToClient(client, otherEmployeeId)).toBe(false);
    expect(
      canUserAccessClient(client, { userRole: 'Manager', employeeId: otherEmployeeId.toString() })
    ).toBe(true);
    expect(
      canUserAccessClient(client, { userRole: 'User', employeeId: employeeId.toString() })
    ).toBe(true);
    expect(
      canUserAccessClient(client, { userRole: 'User', employeeId: otherEmployeeId.toString() })
    ).toBe(false);
  });
});
