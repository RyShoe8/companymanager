import { describe, expect, it, vi } from 'vitest';
import { verifyInstallationRepositoryAccess } from './githubAppClient';

vi.mock('@/lib/ai/githubPublish', () => ({
  githubAppConfigured: vi.fn(() => true),
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      get: vi.fn(async ({ owner, repo }: { owner: string; repo: string }) => {
        if (owner === 'authorized-owner' && repo === 'accessible-repo') {
          return { data: { id: 123, full_name: 'authorized-owner/accessible-repo' } };
        }
        const err = new Error('Not Found');
        (err as { status?: number }).status = 404;
        throw err;
      }),
    },
  })),
}));

describe('verifyInstallationRepositoryAccess (F06)', () => {
  process.env.GITHUB_APP_ID = '12345';
  process.env.GITHUB_APP_PRIVATE_KEY = 'synthetic-key';

  it('approves accessible repository for the installation', async () => {
    const res = await verifyInstallationRepositoryAccess('99999', 'authorized-owner', 'accessible-repo');
    expect(res.ok).toBe(true);
  });

  it('rejects ungranted or foreign repository for the installation', async () => {
    const res = await verifyInstallationRepositoryAccess('99999', 'foreign-owner', 'secret-repo');
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not found or github app is not installed/i);
  });
});
