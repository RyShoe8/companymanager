import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  insertMany: vi.fn(),
  updateOne: vi.fn(),
  createIndexes: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/models/AiIdeChatTurn', () => ({
  AiIdeChatTurn: {
    find: mocks.find,
    insertMany: mocks.insertMany,
    updateOne: mocks.updateOne,
    createIndexes: mocks.createIndexes,
  },
}));

import { appendIdeChatTurns, clearIdeChatTurnPlan, ideThreadKeys, loadIdeChatHistory } from '@/lib/ide/chatHistory';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createIndexes.mockResolvedValue(undefined);
});

describe('ideThreadKeys', () => {
  it('clears Direct keys for worker modes', () => {
    expect(ideThreadKeys({ mode: 'product', modelProfileId: 'p', model: 'm' })).toEqual({
      mode: 'product',
      directProfileId: '',
      directModel: '',
    });
  });

  it('scopes Direct threads by profile and model', () => {
    expect(
      ideThreadKeys({
        mode: 'direct',
        modelProfileId: ' profile-a ',
        model: ' local/model ',
      })
    ).toEqual({
      mode: 'direct',
      directProfileId: 'profile-a',
      directModel: 'local/model',
    });
  });
});

describe('loadIdeChatHistory', () => {
  const projectId = new Types.ObjectId();
  const userId = 'b'.repeat(24);

  it('returns empty for Direct without profile/model', async () => {
    await expect(
      loadIdeChatHistory({
        organizationId: 'org',
        projectId,
        userId,
        mode: 'direct',
      })
    ).resolves.toEqual([]);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it('queries the scoped thread newest-first then reverses', async () => {
    mocks.find.mockReturnValue({
      sort: (spec: unknown) => {
        expect(spec).toEqual({ _id: -1 });
        return {
          limit: () => ({
            maxTimeMS: () => ({
              lean: () =>
                Promise.resolve([
                  {
                    requestId: 'r2',
                    role: 'assistant',
                    text: 'hi',
                    createdAt: new Date('2026-01-02'),
                  },
                  {
                    requestId: 'r1',
                    role: 'user',
                    text: 'yo',
                    createdAt: new Date('2026-01-01'),
                  },
                ]),
            }),
          }),
        };
      },
    });

    const turns = await loadIdeChatHistory({
      organizationId: 'org',
      projectId,
      userId,
      mode: 'engineering',
    });
    expect(mocks.find).toHaveBeenCalledWith({
      organizationId: 'org',
      projectId,
      createdByUserId: new Types.ObjectId(userId),
      mode: { $in: ['marketing', 'product', 'support', 'engineering', 'researcher'] },
      directProfileId: '',
      directModel: '',
    });
    expect(turns.map((item) => item.requestId)).toEqual(['r1', 'r2']);
  });

  it('propagates query failures so the client can keep cached turns', async () => {
    mocks.find.mockReturnValue({
      sort: () => ({
        limit: () => ({
          maxTimeMS: () => ({
            lean: () => Promise.reject(Object.assign(new Error('pool'), { name: 'MongoPoolClearedError' })),
          }),
        }),
      }),
    });
    await expect(
      loadIdeChatHistory({
        organizationId: 'org',
        projectId,
        userId,
        mode: 'product',
      })
    ).rejects.toMatchObject({ name: 'MongoPoolClearedError' });
  });
});

describe('appendIdeChatTurns', () => {
  const projectId = new Types.ObjectId();
  const userId = 'c'.repeat(24);

  it('skips Direct append without selection', async () => {
    await expect(
      appendIdeChatTurns({
        organizationId: 'org',
        projectId,
        userId,
        mode: 'direct',
        turns: [{ requestId: 'a', role: 'user', text: 'x' }],
      })
    ).resolves.toBe(false);
    expect(mocks.insertMany).not.toHaveBeenCalled();
  });

  it('persists Direct turns with profile and model keys', async () => {
    mocks.insertMany.mockResolvedValue([]);
    await expect(
      appendIdeChatTurns({
        organizationId: 'org',
        projectId,
        userId,
        mode: 'direct',
        modelProfileId: 'prof',
        model: 'gpt',
        turns: [
          { requestId: 'u1', role: 'user', text: 'hello' },
          { requestId: 'a1', role: 'assistant', text: 'world' },
        ],
      })
    ).resolves.toBe(true);
    expect(mocks.insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          mode: 'direct',
          directProfileId: 'prof',
          directModel: 'gpt',
          requestId: 'u1',
          role: 'user',
        }),
        expect.objectContaining({
          requestId: 'a1',
          role: 'assistant',
        }),
      ],
      { ordered: false }
    );
  });

  it('returns false when persist fails after retry without plan', async () => {
    mocks.insertMany.mockRejectedValue(new Error('unavailable'));
    await expect(
      appendIdeChatTurns({
        organizationId: 'org',
        projectId,
        userId,
        mode: 'product',
        turns: [{ requestId: 'u1', role: 'user', text: 'hello' }],
      })
    ).resolves.toBe(false);
    expect(mocks.insertMany).toHaveBeenCalledTimes(2);
  });
});

describe('clearIdeChatTurnPlan', () => {
  const projectId = new Types.ObjectId();
  const userId = 'd'.repeat(24);

  it('unsets plan on the scoped turn', async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    await expect(
      clearIdeChatTurnPlan({
        organizationId: 'org',
        projectId,
        userId,
        requestId: ' turn-1 ',
      })
    ).resolves.toBe(true);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        organizationId: 'org',
        projectId,
        createdByUserId: new Types.ObjectId(userId),
        requestId: 'turn-1',
      },
      { $unset: { plan: 1 } }
    );
  });

  it('returns false when requestId is empty', async () => {
    await expect(
      clearIdeChatTurnPlan({
        organizationId: 'org',
        projectId,
        userId,
        requestId: '   ',
      })
    ).resolves.toBe(false);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
