import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  MEETING_NOTES_TAG,
  buildMeetingNotesScopeTag,
  diffNewlyLinkedProjects,
  ensureMeetingNotesDocsForProjects,
} from '@/lib/scheduling/meetingNotesDoc';

vi.mock('@/lib/db/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockFindOne = vi.fn();
const mockProjectFind = vi.fn();
const mockCreateGoogleDocLinkedAsset = vi.fn();

vi.mock('@/lib/models/Asset', () => ({
  default: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

vi.mock('@/lib/models/Project', () => ({
  default: {
    find: (...args: unknown[]) => mockProjectFind(...args),
  },
}));

vi.mock('@/lib/google/workspaceOperations', () => ({
  createGoogleDocLinkedAsset: (...args: unknown[]) => mockCreateGoogleDocLinkedAsset(...args),
}));

describe('meetingNotesDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: new Types.ObjectId(), name: 'Acme Site' }],
      }),
    });
  });

  it('buildMeetingNotesScopeTag uses series id for recurring meetings', () => {
    expect(
      buildMeetingNotesScopeTag({
        _id: new Types.ObjectId(),
        googleRecurringEventId: 'rec-123',
      })
    ).toBe('series:rec-123');
  });

  it('buildMeetingNotesScopeTag uses meeting id for single meetings', () => {
    const id = new Types.ObjectId();
    expect(buildMeetingNotesScopeTag({ _id: id })).toBe(`meeting:${id.toString()}`);
  });

  it('diffNewlyLinkedProjects returns only newly added project ids', () => {
    const a = new Types.ObjectId().toString();
    const b = new Types.ObjectId().toString();
    const c = new Types.ObjectId().toString();
    expect(diffNewlyLinkedProjects([a, b], [b, c])).toEqual([c]);
  });

  it('skips create when a matching meeting notes asset already exists', async () => {
    const projectId = new Types.ObjectId().toString();
    const meetingId = new Types.ObjectId();
    mockFindOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ _id: new Types.ObjectId(), name: 'Existing notes' }),
      }),
    });

    const result = await ensureMeetingNotesDocsForProjects({
      userId: 'user-1',
      meeting: { _id: meetingId, title: 'Kickoff' },
      newlyLinkedProjectIds: [projectId],
    });

    expect(result.created).toEqual([]);
    expect(mockCreateGoogleDocLinkedAsset).not.toHaveBeenCalled();
  });

  it('creates a doc with meeting-notes tags when none exists', async () => {
    const projectId = new Types.ObjectId().toString();
    const meetingId = new Types.ObjectId();
    mockFindOne.mockReturnValue({
      select: () => ({
        lean: async () => null,
      }),
    });
    mockProjectFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: projectId, name: 'Acme Site' }],
      }),
    });
    const assetId = new Types.ObjectId();
    mockCreateGoogleDocLinkedAsset.mockResolvedValue({
      ok: true,
      asset: { _id: assetId, name: 'Acme Site — Kickoff notes' },
      shareWarnings: [],
    });

    const result = await ensureMeetingNotesDocsForProjects({
      userId: 'user-1',
      meeting: { _id: meetingId, title: 'Kickoff' },
      newlyLinkedProjectIds: [projectId],
    });

    expect(mockCreateGoogleDocLinkedAsset).toHaveBeenCalledWith(
      { userId: 'user-1' },
      'Acme Site — Kickoff notes',
      { linkedProjectId: projectId },
      [MEETING_NOTES_TAG, `meeting:${meetingId.toString()}`]
    );
    expect(result.created).toHaveLength(1);
    expect(result.created[0]?.assetId).toBe(assetId.toString());
  });

  it('returns a Drive connect notice when Drive is not connected', async () => {
    const projectId = new Types.ObjectId().toString();
    mockFindOne.mockReturnValue({
      select: () => ({
        lean: async () => null,
      }),
    });
    mockCreateGoogleDocLinkedAsset.mockResolvedValue({ ok: false, reason: 'no_drive' });

    const result = await ensureMeetingNotesDocsForProjects({
      userId: 'user-1',
      meeting: { _id: new Types.ObjectId(), title: 'Sync' },
      newlyLinkedProjectIds: [projectId],
    });

    expect(result.created).toEqual([]);
    expect(result.notice).toContain('Connect Google Drive');
  });
});
