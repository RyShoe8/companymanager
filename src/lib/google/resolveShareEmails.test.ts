import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

vi.mock('@/lib/db/mongodb', () => ({ default: vi.fn(async () => undefined) }));

const mockUserFindById = vi.fn();
const mockProjectFindById = vi.fn();
const mockProjectFind = vi.fn();
const mockClientFindById = vi.fn();
const mockEmployeeFind = vi.fn();
const mockUserFind = vi.fn();

vi.mock('@/lib/models/User', () => ({
  default: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
    find: (...args: unknown[]) => mockUserFind(...args),
  },
}));

vi.mock('@/lib/models/Project', () => ({
  default: {
    findById: (...args: unknown[]) => mockProjectFindById(...args),
    find: (...args: unknown[]) => mockProjectFind(...args),
  },
}));

vi.mock('@/lib/models/Client', () => ({
  default: {
    findById: (...args: unknown[]) => mockClientFindById(...args),
  },
}));

vi.mock('@/lib/models/Employee', () => ({
  default: {
    find: (...args: unknown[]) => mockEmployeeFind(...args),
  },
}));

import { resolveShareEmailsForAssetLink } from '@/lib/google/resolveShareEmails';

describe('resolveShareEmailsForAssetLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          email: 'owner@example.com',
          organizationId: new Types.ObjectId('507f1f77bcf86cd799439011'),
        }),
      }),
    });
  });

  it('resolves project team and client contact emails', async () => {
    const projectId = new Types.ObjectId();
    const clientId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    mockProjectFindById.mockReturnValue({
      lean: async () => ({
        assignedToEmployeeIds: [employeeId],
        tasks: [{ assignedToEmployeeIds: [] }],
        clientId,
        invitedClientEmails: ['invited@client.com'],
      }),
    });

    mockEmployeeFind.mockReturnValue({
      lean: async () => [
        {
          _id: employeeId,
          userId,
          email: 'teammate@example.com',
        },
      ],
    });

    mockUserFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: userId, email: 'teammate@example.com' }],
      }),
    });

    mockClientFindById.mockReturnValue({
      lean: async () => ({
        contactEmail: 'contact@client.com',
        userIds: [],
      }),
    });

    const emails = await resolveShareEmailsForAssetLink({
      actingUserId: '507f1f77bcf86cd799439099',
      linkedProjectId: projectId.toString(),
    });

    expect(emails).toContain('teammate@example.com');
    expect(emails).toContain('contact@client.com');
    expect(emails).toContain('invited@client.com');
    expect(emails).not.toContain('owner@example.com');
  });

  it('dedupes emails for client-linked assets', async () => {
    mockClientFindById.mockReturnValue({
      lean: async () => ({
        contactEmail: 'same@client.com',
        userIds: [new Types.ObjectId()],
      }),
    });

    mockUserFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: new Types.ObjectId(), email: 'same@client.com' }],
      }),
    });

    mockProjectFind.mockReturnValue({
      lean: async () => [],
    });

    const emails = await resolveShareEmailsForAssetLink({
      actingUserId: '507f1f77bcf86cd799439099',
      linkedClientId: '507f1f77bcf86cd799439022',
    });

    expect(emails).toEqual(['same@client.com']);
  });
});
