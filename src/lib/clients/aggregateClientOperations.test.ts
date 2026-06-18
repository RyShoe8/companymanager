import { describe, expect, it } from 'vitest';
import {
  aggregateClientPlatforms,
  aggregateClientAssets,
  isProjectLevelAsset,
} from '@/lib/clients/aggregateClientOperations';
import { validateAssetLinkExclusivity } from '@/lib/assets/validateAssetLinks';

describe('aggregateClientPlatforms', () => {
  it('dedupes platforms by category and id, preferring client source first', () => {
    const client = {
      techStack: [{ category: 'hosting' as const, technologyId: 'vercel' }],
      marketingStack: [],
      socialLinks: [],
    };
    const projects = [
      {
        _id: 'p1',
        name: 'Site',
        techStack: [
          { category: 'hosting' as const, technologyId: 'vercel' },
          { category: 'database' as const, technologyId: 'mongodb' },
        ],
        marketingStack: [],
        socialLinks: [],
      },
    ];

    const result = aggregateClientPlatforms(client, projects as never);
    expect(result.techStack).toHaveLength(2);
    expect(result.techStack[0].source).toEqual({ type: 'client' });
    expect(result.techStack[1].source).toEqual({
      type: 'project',
      projectId: 'p1',
      projectName: 'Site',
    });
  });
});

describe('aggregateClientAssets', () => {
  it('merges client and project assets with source metadata', () => {
    const merged = aggregateClientAssets(
      [{ _id: 'a1', name: 'Client doc', type: 'document', tags: [], userId: 'u1' } as never],
      [
        {
          _id: 'a2',
          name: 'Project doc',
          type: 'link',
          tags: [],
          userId: 'u1',
          projectId: 'p1',
          projectName: 'Site',
        } as never,
      ]
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toEqual({ type: 'client' });
    expect(merged[1].source).toEqual({ type: 'project', projectId: 'p1', projectName: 'Site' });
  });
});

describe('isProjectLevelAsset', () => {
  it('returns true only for project-level links', () => {
    expect(isProjectLevelAsset({})).toBe(true);
    expect(isProjectLevelAsset({ linkedProjectTaskId: 't1' } as never)).toBe(false);
    expect(isProjectLevelAsset({ linkedContentItemId: 'c1' } as never)).toBe(false);
  });
});

describe('validateAssetLinkExclusivity', () => {
  it('rejects client plus project links', () => {
    expect(
      validateAssetLinkExclusivity({
        linkedClientId: '507f1f77bcf86cd799439011',
        linkedProjectId: '507f1f77bcf86cd799439012',
      })
    ).toMatch(/cannot also link/i);
  });

  it('allows client-only links', () => {
    expect(
      validateAssetLinkExclusivity({
        linkedClientId: '507f1f77bcf86cd799439011',
      })
    ).toBeNull();
  });
});
