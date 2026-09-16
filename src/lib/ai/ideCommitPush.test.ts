import { describe, expect, it, vi } from 'vitest';
import { ideCommitPushSchema } from '@/lib/ai/idePublishSchema';

describe('ideCommitPushSchema', () => {
  it('requires explicit confirm', () => {
    expect(() =>
      ideCommitPushSchema.parse({
        confirm: false,
        message: 'x',
        files: [{ path: 'a.ts', content: '1' }],
      })
    ).toThrow();
  });

  it('accepts a confirmed single-file push payload', () => {
    const parsed = ideCommitPushSchema.parse({
      confirm: true,
      message: 'Fix typo',
      files: [{ path: 'README.md', content: '# Hi' }],
    });
    expect(parsed.confirm).toBe(true);
    expect(parsed.files).toHaveLength(1);
  });

  it('accepts expectedSha in file schema', () => {
    const parsed = ideCommitPushSchema.parse({
      confirm: true,
      message: 'Update file',
      files: [{ path: 'src/main.ts', content: 'code', expectedSha: 'abc123sha' }],
    });
    expect(parsed.files[0].expectedSha).toBe('abc123sha');
  });

  it('returns blocked conflict status when file sha changed since loaded', async () => {
    const { commitAndPushToDefaultBranch } = await import('./ideCommitPush');
    const githubApp = await import('./githubAppClient');
    const githubPublish = await import('./githubPublish');
    const AiProjectRepository = (await import('@/lib/models/AiProjectRepository')).AiProjectRepository;
    const { Types } = await import('mongoose');

    vi.spyOn(githubPublish, 'githubAppConfigured').mockReturnValue(true);
    vi.spyOn(AiProjectRepository, 'findOne').mockReturnValue({
      select: () => ({
        maxTimeMS: () => ({
          lean: async () => ({
            owner: 'test-org',
            repo: 'test-repo',
            defaultBranch: 'main',
            installationId: '12345',
          }),
        }),
      }),
    } as never);

    vi.spyOn(githubApp, 'createInstallationOctokit').mockReturnValue({
      repos: {
        getContent: async () => ({ data: { sha: 'different_new_sha' } }),
      },
    } as never);

    const result = await commitAndPushToDefaultBranch('org-id', new Types.ObjectId(), {
      confirm: true,
      message: 'Conflict check',
      files: [{ path: 'src/main.ts', content: 'new content', expectedSha: 'old_sha_when_opened' }],
    });

    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toMatch(/conflict/i);
      expect(result.commitSha).toBeNull();
    }
  });
});

